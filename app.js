var express = require('express'),
	app = express(),
	rest = require('restler'),
	ejs = require('ejs'),
	mongo = require('mongodb'),
	url = require("url"),
	fs = require('fs'),
	sys = require('sys'),
    MongoStore = require('connect-mongo')(express),
    nodemailer = require('nodemailer'),
    crypto = require('crypto'),
    request = require('request'),
    config = require('./config.js'),
	im = require('imagemagick');

if(process.env.MONGOLAB_URI) {
    console.log('Found MongoLab URI environment variable, using its settings.');
    console.log('MongoLab URI: ' + process.env.MONGOLAB_URI);
    var mu = process.env.MONGOLAB_URI;
    config.db.url = mu.split(':')[2].split('@')[1];
    config.db.prt = parseInt(mu.split(':')[3].split('/')[0]);
    config.db.name = mu.split('/').pop();
    config.db.username = mu.split(':')[1].replace('/', '').replace('/', '');
    config.db.pwd = mu.split(':')[2].split('@')[0];
}

var db = new mongo.Db(config.db.name, new mongo.Server(config.db.url, config.db.prt, {
    	auto_reconnect: true
	}), {});

db.open(function(err, db) {
    db.authenticate(config.db.username, config.db.pwd, function(err, result) {
        console.log('Successfully opened database connection and authenticated.');
    });
});

//Configure path to ImageMagick, should be unnecessary
im.identify.path = config.im.identify;
im.convert.path = config.im.convert;

app.use(express.cookieParser());
app.use(express.session({
	secret: "thisIsSparta!",
    store: new MongoStore({
      db: config.db.name,
      host: config.db.url,
      port: config.db.prt,
      username: config.db.username,
      password: config.db.pwd,
      auto_reconnect: true
    })
}));
app.use(express.bodyParser({
	uploadDir: __dirname + '/images'
}));

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use('/js', express.static(__dirname + '/js'));
app.use('/css', express.static(__dirname + '/css'));
app.use('/pngs', express.static(__dirname + '/pngs'));
//app.use('/images', express.static(__dirname + '/images'));

// Serve images out of MongoDB
app.get('/images/:name', function(req, res) {
    db.collection('images', function(err, collection) {
        collection.findOne({
            "name": req.params.name
        }, function(err, document) {
            if(document) {
                var im = new Buffer(document.data, 'base64');
                res.writeHead(200, {
                  'Content-Type': 'image/jpeg',
                  'Content-Length': im.length
                });
                res.end(im);
            } else {
                res.send(404);
            }
        });
    });
});

app.get('/:user/:gallery/draw', function(req, res) {
    res.render('draw', {
		layout: false,
		data: {}
	});
});

app.post('/:user/:gallery/publish', function(req, res) {
    console.log('Got publish request for user ' + req.params.user + ' and gallery ' + req.params.gallery);
    var user = req.params.user.toLowerCase();
    var gallery = req.params.gallery.toLowerCase();
    if(req.session.user==user) {
//        db.open(function(err, db) {
    		db.collection('users', function(err, collection) {
    			collection.findOne({
    				"user": user
    			}, function(err, document) {
    				var gal = document.galleries[gallery];
        			db.collection('users_public', function(err, collection) {
                		collection.findOne({
            				"user": user
            			}, function(err, document) {
            				document.galleries[gallery] = gal;
            				collection.update({
            					"user": user
            				}, document, {
            					upsert: true,
            					safe: true
            				}, function(err, document) {
//                                db.close();
//                                var pp = config.storage.url + user + '-' + gallery + '-bg.png';
//                                var pb = config.storage.url + user + '-' + gallery + '-bg-public.png';
//                                request.get(pp).pipe(request.post(pb));
                                    db.collection('images', function(err, collection) {
                                        collection.findOne({
                                            "name": user + '-' + gallery + '-bg.png'
                                        }, function(err, document) {
                                            if(document) {
                                                    collection.update({
                                                        "name": user + '-' + gallery + '-bg-public.png'
                                                    }, {
                                                        "name": user + '-' + gallery + '-bg-public.png',
                                                        "data": document.data
                                                    }, {
                                                        upsert: true,
                                                        safe: true
                                                    }, function(err, document) {
                                                        res.send(200, {success:true});
                                                    });
                                            } else {
                                                res.send(404);
                                            }
                                        });
                                    });
            				});
            			});
        			});
    			});
    		});
//    	});
    } else {
        res.send(400, 'Sorry, but you do not have access to publish this gallery.');
    }
});

app.post('/:user/:gallery/unpublish', function(req, res) {
    var user = req.params.user.toLowerCase();
    console.log('Got unpublish request for user ' + req.params.user + ' and gallery ' + req.params.gallery);
    if(req.session.user==user) {
        var gallery = req.params.gallery.toLowerCase();
//        db.open(function(err, db) {
    		db.collection('users_public', function(err, collection) {
    			collection.findOne({
    				"user": user
    			}, function(err, document) {
    				var gals = document.galleries;
    				for (var i in gals) {
    					if (i == gallery) delete gals[i];
    				}
    				document.galleries = gals;
    				collection.update({
    					"user": user
    				}, document, {
    					upsert: true,
    					safe: true
    				}, function(err, document) {
//    					db.close();
                        res.send(200, {success:true});
    				});
    			});
    		});
//    	});
    } else {
        res.send(400, 'Sorry, but you do not have access to manage these galleries.');
    }
});

//app.get('/:user/:gallery/photos/new', function(req, res) {
//    console.log('got new photo get');
//	res.send('<form method="post" enctype="multipart/form-data">' + '<p>Image: <input type="file" name="image" multiple/></p>' + '<p><input type="submit" value="Upload" /></p>' + '</form>');
//});

function processUpload(req, res) {
    
    function saveToDb() {
//        db.open(function(err, db) {
            db.collection('users', function(err, collection) {
                collection.findOne({
                    "user": req.params.user
                }, function(err, document) {
                    var gal = document.galleries[req.params.gallery];
                    var p = 0;
                    for (var i in gal) p += 1;
                    gal[p] = new Object();
                    // This is only when using Riak
                    //gal[p].source = config.storage.url + req.files.image.path.split('/').pop() + '.jpg';
                    gal[p].source = '/images/' + req.files.image.path.split('/').pop() + '.jpg';
                    gal[p].top = Math.floor(Math.random() * 701);
                    gal[p].left = Math.floor(Math.random() * 901);
                    gal[p].link = '';
                    im.identify(req.files.image.path, function(err, features) {
                        var ratio = features.width / features.height;
                        gal[p].width = Math.round(Math.random() * 100) + 150;
                        gal[p].height = Math.round(gal[p].width / ratio);
                        document.galleries[req.params.gallery] = gal;
                        collection.update({
                            "user": req.params.user
                        }, document, {
                            upsert: true,
                            safe: true
                        }, function(err, document) {
//                            db.close();
                            res.redirect('back');
                        });
                    });
                });
            });
//        });
    }
    // For tracking the parallel events
    var parallel = 3;

    var mop = req.files.image.path.split('/').pop() + '-medium.jpg';
//    im.convert([req.files.image.path, '-quality', '85', '-resize', '900x900\>', mop], function(err) {
//    	if (err) throw err;
//        fs.readFile(mop, function (err, imageData) {
//            if (err) throw err;
//            request.post({
//                    headers: {'Content-Type': 'image/jpeg'},
//                    url: config.storage.url + mop.split('/').pop(),
//                    body: imageData
//                }, function(error, response, body) {
//                    parallel -= 1;
//                    if(parallel===0) saveToDb();
//            });
//        });
//	});

    im.convert([req.files.image.path, '-quality', '85', '-resize', '900x900\>', __dirname + '/images/' + mop], function(err) {
        if (err) throw err;
        fs.readFile(__dirname + '/images/' + mop, function(err, imageData) {
            if (err) throw err;
            db.collection('images', function(err, collection) {
                var b64 = new Buffer(imageData).toString('base64');
                b64 = b64;
                collection.update({
                    "name": mop
                }, {
                    "name": mop,
                    "data": b64
                }, {
                    upsert: true,
                    safe: true
                }, function(err, document) {
                    parallel -= 1;
                    if (parallel === 0) saveToDb();
                });
            });
        });
    });

    var sop = req.files.image.path.split('/').pop() + '-small.jpg';
//    im.convert([req.files.image.path, '-quality', '80', '-resize', '400x400\>', sop], function(err) {
//        if (err) throw err;
//        fs.readFile(sop, function (err, imageData) {
//            if (err) throw err;
//            request.post({
//                    headers: {'Content-Type': 'image/jpeg'},
//                    url: config.storage.url + sop.split('/').pop(),
//                    body: imageData
//                }, function(error, response, body) {
//                    parallel -= 1;
//                    if(parallel===0) saveToDb();
//            });
//        });
//	});

    im.convert([req.files.image.path, '-quality', '80', '-resize', '400x400\>', __dirname + '/images/' + sop], function(err) {
        if (err) throw err;
        fs.readFile(__dirname + '/images/' + sop, function(err, imageData) {
            if (err) throw err;
            db.collection('images', function(err, collection) {
                var b64 = new Buffer(imageData).toString('base64');
                b64 = b64;
                collection.update({
                    "name": sop
                }, {
                    "name": sop,
                    "data": b64
                }, {
                    upsert: true,
                    safe: true
                }, function(err, document) {
                    parallel -= 1;
                    if (parallel === 0) saveToDb();
                });
            });
        });
    });

    var lop = req.files.image.path.split('/').pop() + '-large.jpg';
//	im.convert([req.files.image.path, '-quality', '85', '-resize', '1600x1600\>', lop], function(err) {
//		if (err) throw err;
//        fs.readFile(lop, function (err, imageData) {
//            if (err) throw err;
//            request.post({
//                    headers: {'Content-Type': 'image/jpeg'},
//                    url: config.storage.url + lop.split('/').pop(),
//                    body: imageData
//                }, function(error, response, body) {
//                    parallel -= 1;
//                    if(parallel===0) saveToDb();
//            });
//        });
//	});

    im.convert([req.files.image.path, '-quality', '85', '-resize', '1600x1600\>', __dirname + '/images/' + lop], function(err) {
        if (err) throw err;
        fs.readFile(__dirname + '/images/' + lop, function(err, imageData) {
            if (err) throw err;
            db.collection('images', function(err, collection) {
                var b64 = new Buffer(imageData).toString('base64');
                b64 = b64;
                collection.update({
                    "name": lop
                }, {
                    "name": lop,
                    "data": b64
                }, {
                    upsert: true,
                    safe: true
                }, function(err, document) {
                    parallel -= 1;
                    if (parallel === 0) saveToDb();
                });
            });
        });
    });
    
}

function processUploads(req, res, k) {
    // For tracking the parallel tasks
    var parallel = 3;
        
    function saveToDb() {
//        db.open(function(err, db) {
            db.collection('users', function(err, collection) {
                collection.findOne({
                    "user": req.params.user
                }, function(err, document) {
                    var gal = document.galleries[req.params.gallery];
                    var p = 0;
                    for (var i in gal) p += 1;
                    gal[p] = new Object();
                    //Only for Riak use
                    //gal[p].source = config.storage.url + req.files.image[k].path.split('/').pop() + '.jpg';
                    gal[p].source = '/images/' + req.files.image[k].path.split('/').pop() + '.jpg';
                    gal[p].top = Math.floor(Math.random() * 701);
                    gal[p].left = Math.floor(Math.random() * 901);
                    gal[p].link = '';
                    im.identify(req.files.image[k].path, function(err, features) {
                        var ratio = features.width / features.height;
                        gal[p].width = Math.round(Math.random() * 100) + 150;
                        gal[p].height = Math.round(gal[p].width / ratio);
                        document.galleries[req.params.gallery] = gal;
                        collection.update({
                            "user": req.params.user
                        }, document, {
                            upsert: true,
                            safe: true
                        }, function(err, document) {
//                            db.close();
                            k += 1;
                            processUploads(req, res, k);
                        });
                    });
                });
            });
//        });
    }
    
	if (req.files.image[k]) {
        
        var mop = req.files.image[k].path.split('/').pop() + '-medium.jpg';
//		im.convert([req.files.image[k].path, '-quality', '85', '-resize', '900x900\>', mop], function(err) {
//			if (err) throw err;
//            fs.readFile(mop, function (err, imageData) {
//                if (err) throw err;
//                request.post({
//                        headers: {'Content-Type': 'image/jpeg'},
//                        url: config.storage.url + mop.split('/').pop(),
//                        body: imageData
//                    }, function(error, response, body) {
//                        parallel -= 1;
//                        if(parallel===0) saveToDb();
//                });
//            });
//		});

        im.convert([req.files.image[k].path, '-quality', '85', '-resize', '900x900\>', __dirname + '/images/' + mop], function(err) {
            if (err) throw err;
            fs.readFile(__dirname + '/images/' + mop, function(err, imageData) {
                if (err) throw err;
                db.collection('images', function(err, collection) {
                    var b64 = new Buffer(imageData).toString('base64');
                    b64 = b64;
                    collection.update({
                        "name": mop
                    }, {
                        "name": mop,
                        "data": b64
                    }, {
                        upsert: true,
                        safe: true
                    }, function(err, document) {
                        parallel -= 1;
                        if (parallel === 0) saveToDb();
                    });
                });
            });
        });
	
        var sop = req.files.image[k].path.split('/').pop() + '-small.jpg';
//		im.convert([req.files.image[k].path, '-quality', '80', '-resize', '400x400\>', sop], function(err) {
//			if (err) throw err;
//            fs.readFile(sop, function (err, imageData) {
//                if (err) throw err;
//                request.post({
//                        headers: {'Content-Type': 'image/jpeg'},
//                        url: config.storage.url + sop.split('/').pop(),
//                        body: imageData
//                    }, function(error, response, body) {
//                        parallel -= 1;
//                        if(parallel===0) saveToDb();
//                });
//            });
//		});

        im.convert([req.files.image[k].path, '-quality', '80', '-resize', '400x400\>', __dirname + '/images/' + sop], function(err) {
            if (err) throw err;
            fs.readFile(__dirname + '/images/' + sop, function(err, imageData) {
                if (err) throw err;
                db.collection('images', function(err, collection) {
                    var b64 = new Buffer(imageData).toString('base64');
                    b64 = b64;
                    collection.update({
                        "name": sop
                    }, {
                        "name": sop,
                        "data": b64
                    }, {
                        upsert: true,
                        safe: true
                    }, function(err, document) {
                        parallel -= 1;
                        if (parallel === 0) saveToDb();
                    });
                });
            });
        });
        
        var lop = req.files.image[k].path.split('/').pop() + '-large.jpg';
//		im.convert([req.files.image[k].path, '-quality', '85', '-resize', '1600x1600\>', lop], function(err) {
//			if (err) throw err;
//            fs.readFile(lop, function (err, imageData) {
//                if (err) throw err;
//                request.post({
//                        headers: {'Content-Type': 'image/jpeg'},
//                        url: config.storage.url + lop.split('/').pop(),
//                        body: imageData
//                    }, function(error, response, body) {
//                        parallel -= 1;
//                        if(parallel===0) saveToDb();
//                });
//            });
//		});

        im.convert([req.files.image[k].path, '-quality', '85', '-resize', '1600x1600\>', __dirname + '/images/' + lop], function(err) {
            if (err) throw err;
            fs.readFile(__dirname + '/images/' + lop, function(err, imageData) {
                if (err) throw err;
                db.collection('images', function(err, collection) {
                    var b64 = new Buffer(imageData).toString('base64');
                    b64 = b64;
                    collection.update({
                        "name": lop
                    }, {
                        "name": lop,
                        "data": b64
                    }, {
                        upsert: true,
                        safe: true
                    }, function(err, document) {
                        parallel -= 1;
                        if (parallel === 0) saveToDb();
                    });
                });
            });
        });
    
	}
	else {
		res.redirect('back');
	}
}

app.post('/:user/:gallery/photos/new', function(req, res, next) {
    console.log('Got new photo post');
    if(req.session.user==req.params.user) {
    	if (req.files.image.path) processUpload(req, res);
    	else {
    		processUploads(req, res, 0);
    	}
    } else {
        res.send(400, 'Sorry, but you do not have permission to upload files to this gallery.');
    }
});

app.post('/:user/:gallery/photos/drawn/uploadDrawnImage', function(req, res) {
    console.log('Got uploaded drawn image');
    if(req.session.user==req.params.user) {
        var data = req.body.f1.replace(/^data:image\/\w+;base64,/, "");
    	var buf = new Buffer(data, 'base64');
        var path = __dirname + '/images/' + Math.round(Math.random()*100000) + '.png';
        var mop = path.split('.')[0] + '-medium.png';
    	fs.writeFile(path, buf, function() {
            im.convert([path, '-quality', '85', '-resize', '900x900\>', mop], function(err) {
                if (err) throw err;
                fs.readFile(mop, function (err, imageData) {
                    if (err) throw err;
//                    request.post({
//                            headers: {'Content-Type': 'image/png'},
//                            url: config.storage.url + mop.split('/').pop(),
//                            body: imageData
//                        }, function(error, response, body) {
//                            
//                    });
                    db.collection('images', function(err, collection) {
                        var b64 = new Buffer(imageData).toString('base64');
                        b64 = b64;
                        collection.update({
                            "name": mop
                        }, {
                            "name": mop,
                            "data": b64
                        }, {
                            upsert: true,
                            safe: true
                        }, function(err, document) {
                            
                        });
                    });
                });
            });
            
            var lop = path.split('.')[0] + '-large.png';
            im.convert([path, '-quality', '85', '-resize', '1600x1600\>', lop], function(err) {
                if (err) throw err;
                fs.readFile(lop, function (err, imageData) {
                    if (err) throw err;
//                    request.post({
//                            headers: {'Content-Type': 'image/png'},
//                            url: config.storage.url + lop.split('/').pop(),
//                            body: imageData
//                        }, function(error, response, body) {
//                            
//                    });
                    db.collection('images', function(err, collection) {
                        var b64 = new Buffer(imageData).toString('base64');
                        b64 = b64;
                        collection.update({
                            "name": lop
                        }, {
                            "name": lop,
                            "data": b64
                        }, {
                            upsert: true,
                            safe: true
                        }, function(err, document) {
                            
                        });
                    });
                });
        	});
            
            var sop = path.split('.')[0] + '-small.png';
        	im.convert([path, '-quality', '80', '-resize', '400x400\>', sop], function(err) {
        		if (err) throw err;
                fs.readFile(sop, function (err, imageData) {
                    if (err) throw err;
//                    request.post({
//                            headers: {'Content-Type': 'image/png'},
//                            url: config.storage.url + sop.split('/').pop(),
//                            body: imageData
//                        }, function(error, response, body) {
                    db.collection('images', function(err, collection) {
                        var b64 = new Buffer(imageData).toString('base64');
                        b64 = b64;
                        collection.update({
                            "name": sop
                        }, {
                            "name": sop,
                            "data": b64
                        }, {
                            upsert: true,
                            safe: true
                        }, function(err, document) {
//                        	db.open(function(err, db) {
                    			db.collection('users', function(err, collection) {
                    				collection.findOne({
                    					"user": req.params.user
                    				}, function(err, document) {
                    					var gal = document.galleries[req.params.gallery];
                    					var p = 0;
                    					for (var i in gal) p += 1;
                    					gal[p] = new Object();
                                        // Only for Riak
                    					//gal[p].source = config.storage.url + path.split('/').pop();
                                        gal[p].source = '/images/' + path.split('/').pop();
                    					gal[p].top = Math.floor(Math.random() * 701);
                    					gal[p].left = Math.floor(Math.random() * 901);
                    					gal[p].link = '';
                    					im.identify(path, function(err, features) {
                    						var ratio = features.width / features.height;
                    						gal[p].width = Math.round(Math.random() * 100) + 150;
                    						gal[p].height = Math.round(gal[p].width / ratio);
                    						document.galleries[req.params.gallery] = gal;
                    						collection.update({
                    							"user": req.params.user
                    						}, document, {
                    							upsert: true,
                    							safe: true
                    						}, function(err, document) {
//                    							db.close();
                    							res.redirect('back');
                    						});
                    					});
                    				});
                    			});
                                
                            });
                        });
//                    		});
//                    });
                });
        	});
        });
    } else {
        res.send(400, 'Sorry, but you do not have access to upload photos to this gallery.');
    }
});

app.post('/:user/:gallery/uploadBackground', function(req, res, next) {
    console.log('got new background');
    if(req.session.user==req.params.user) {
    	var data = req.body.f1.replace(/^data:image\/\w+;base64,/, "");
    	var buf = new Buffer(data, 'base64');
        var p = __dirname + '/images/' + req.params.user + '-' + req.params.gallery + '-bg.png';
    	fs.writeFile(p, buf, null, function(err) {
            res.send(200, {success:true});
            fs.readFile(p, function (err, imageData) {
                if (err) throw err;
//                request.post({
//                        headers: {'Content-Type': 'image/png'},
//                        url: config.storage.url + p.split('/').pop(),
//                        body: imageData
//                    }, function(error, response, body) {
//                        
//                });

                    db.collection('images', function(err, collection) {
                        var b64 = new Buffer(imageData).toString('base64');
                        b64 = b64;
                        collection.update({
                            "name": p.split('/').pop()
                        }, {
                            "name": p.split('/').pop(),
                            "data": b64
                        }, {
                            upsert: true,
                            safe: true
                        }, function(err, document) {
                            
                        });
                    });
            });
        });
    } else {
        res.send(400, 'Sorry, but you do not have access to upload photos to this gallery.');
    }
});

//app.post('/:user/:gallery/photos/newlink', function(req, res, next) {
//    console.log('got new link photo');
//    if(req.session.user==req.params.user) {
//        im.convert([req.files.image.path, '-quality', '85', '-resize', '900x900\>', req.files.image.path.split('.')[0] + '-medium.jpg'], function(err) {
//            if (err) throw err;
//    	});
//        
//        im.convert([req.files.image.path, '-quality', '85', '-resize', '1600x1600\>', req.files.image.path.split('.')[0] + '-large.jpg'], function(err) {
//            if (err) throw err;
//    	});
//        
//    	im.convert([req.files.image.path, '-quality', '50', '-resize', '400x400\>', req.files.image.path.split('.')[0] + '-small.jpg'], function(err) {
//    		if (err) throw err;
//    		db.open(function(err, db) {
//    			db.collection('users', function(err, collection) {
//    				collection.findOne({
//    					"user": req.params.user
//    				}, function(err, document) {
//    					var gal = document.galleries[req.params.gallery];
//    					var p = 0;
//    					for (var i in gal) p += 1;
//    					gal[p] = new Object();
//    					gal[p].source = '/images/' + req.files.image.path.split('/').pop()+'.jpg';;
//    					gal[p].top = Math.floor(Math.random() * 701);
//    					gal[p].left = Math.floor(Math.random() * 901);
//    					gal[p].link = req.body.link;
//    					im.identify(req.files.image.path, function(err, features) {
//    						var ratio = features.width / features.height;
//    						gal[p].width = Math.round(Math.random() * 100) + 150;
//    						gal[p].height = Math.round(gal[p].width / ratio);
//    						document.galleries[req.params.gallery] = gal;
//    						collection.update({
//    							"user": req.params.user
//    						}, document, {
//    							upsert: true,
//    							safe: true
//    						}, function(err, document) {
//    							db.close();
//    							res.redirect('back');
//    						});
//    					});
//    				});
//    			});
//    		});
//    	});
//    } else {
//        res.send('Sorry, but you do not have access to upload photos to this gallery.');
//    }
//});

app.get('/home/users', function(req, res) {
//    db.open(function(err, db) {
        db.collection('users_public', function(err, collection) {
            var users = new Array();
            collection.find().toArray(function(err, document) {
                var j = 0;
                var k = 0;
                for (var i = 0; i < document.length; i++) {
                    users[i] = document[i].user;
                }
                var loggedin = false;
                if(req.session.user) loggedin = true;
                res.render('users', {
                    layout: false,
                    data: {
                        user: req.session.user,
                        params: {'user':req.params.user},
                        users: users,
                        loggedin: loggedin
                    }
                });
//                db.close();
            });
        });
//    });
});

app.get('/favicon.ico', function(req, res) {
    res.send(200);
});

app.get('/:user', function(req, res) {
    if (req.session.user == req.params.user.toLowerCase()) {
//        db.open(function(err, db) {
            db.collection('users', function(err, collection) {
                var users = new Array();
                collection.find().toArray(function(err, document) {
                    var j = -1;
                	for (var i = 0; i < document.length; i++) {
    					users[i] = document[i].user;
                        if(document[i].user==req.params.user) j = i;
    				}
                    var loggedin = false;
                    if(req.session.user) loggedin = true;
        			if (document[j]) {
        				res.render('galleries', {
        					layout: false,
        					data: {
                                user: req.session.user,
            					params: {'user':req.params.user},
                                galleries: document[j].galleries,
                                loggedin: loggedin
        					}
        				});
        			} else res.send('User does not exist!');
//        		db.close();
    			});
    		});
//    	});
    } else {
//        db.open(function(err, db) {
            db.collection('users_public', function(err, collection) {
                var users = new Array();
                collection.find().toArray(function(err, document) {
                    var j = -1;
            		for (var i = 0; i < document.length; i++) {
    					users[i] = document[i].user;
                        if(document[i].user==req.params.user) j = i;
    				}
                    var loggedin = false;
                    if(req.session.user) loggedin = true;
        			if (document[j]) {
        				res.render('galleries', {
        					layout: false,
        					data: {
                                user: req.session.user,
            					params: {'user':req.params.user},
                                galleries: document[j].galleries,
                                loggedin: loggedin
        					}
        				});
        			} else res.send('User does not exist!');
//        		db.close();
    			});
    		});
//    	});
    }
});

//app.get('/home/:user', function(req, res) {
//    if ((req.session.user == 'home') || (req.session.user == req.params.user.toLowerCase())) {
//        db.open(function(err, db) {
//            db.collection('users', function(err, collection) {
//                var users = new Array();
//                collection.find().toArray(function(err, document) {
//                    var j = 0;
//                    var k = 0;
//        			for (var i = 0; i < document.length; i++) {
//    					users[i] = document[i].user;
//                        if(document[i].user==req.params.user) j = i;
//                        if((document[i].user=='home')) k = i;
//    				}
//                    var u = req.params.user.toLowerCase();
//                    var gallery = 'galleries';
//                    if(req.params.user=='users') gallery = 'users';
//                    if(req.params.user=='galleries') u = 'galleries';
//        			if (document[k].galleries[gallery]) {
//                        if (req.session.user == 'home') {
//            				res.render('index', {
//            					layout: false,
//            					data: {
//            						images: document[k].galleries[gallery],
//            						params: {'user':'home','gallery':gallery, 'u': u},
//                                    galleries: document[j].galleries,
//                                    users: users
//            					}
//            				});
//                        } else {
//                            res.render('public', {
//                				layout: false,
//            					data: {
//            						images: document[k].galleries[gallery],
//            						params: {'user':'home','gallery':gallery, 'u': u},
//                                    galleries: document[j].galleries,
//                                    users: users
//            					}
//            				});
//                        }
//        			} else res.send('User does not exist!');
//        		db.close();
//    			});
//    		});
//    	});
//    } else {
//        db.open(function(err, db) {
//            db.collection('users_public', function(err, collection) {
//                var users = new Array();
//                collection.find().toArray(function(err, document) {
//                    var j = 0;
//                    var k = 0;
//            		for (var i = 0; i < document.length; i++) {
//    					users[i] = document[i].user;
//                        if(document[i].user==req.params.user) j = i;
//                        if((document[i].user=='home')) k = i;
//    				}
//                    var u = req.params.user.toLowerCase();
//                    var gallery = 'galleries';
//                    if(req.params.user=='users') gallery = 'users';
//                    if(req.params.user=='galleries') u = 'galleries';
//        			if (document[k].galleries[gallery]) {
//        				res.render('public', {
//        					layout: false,
//        					data: {
//        						images: document[k].galleries[gallery],
//            					params: {'user':'home','gallery':gallery, 'u': u},
//                                galleries: document[j].galleries,
//                                users: users
//        					}
//        				});
//        			}
//        		else res.send('User does not exist!');
//        		db.close();
//    			});
//    		});
//    	});
//    }
//});

app.get('/:user/:gallery', function(req, res) {
    var user = req.params.user.toLowerCase();
    var gallery = req.params.gallery.toLowerCase();
    if (req.session.user == user) {
        var loggedin = false;
        if(req.session.user) loggedin = true;
//        db.open(function(err, db) {
    		db.collection('users', function(err, collection) {
    			collection.findOne({
    				"user": user
    			}, function(err, document) {
    				if (document) {
    					if (document.galleries[gallery]) {
    						res.render('index', {
    							layout: false,
    							data: {
    								images: document.galleries[gallery],
                                    storage: config.storage.url,
                                    user: req.session.user,
    								params: req.params,
                                    loggedin: loggedin
    							}
    						});
    					}
    					else res.send('Gallery does not exist!');
    				}
    				else res.send('User does not exist!');
//    				db.close();
    			});
    		});
//    	});
    } else {
//        db.open(function(err, db) {
        	db.collection('users_public', function(err, collection) {
    			collection.findOne({
    				"user": user
    			}, function(err, document) {
    				if (document) {
    					if (document.galleries[gallery]) {
    						res.render('public', {
    							layout: false,
    							data: {
    								images: document.galleries[gallery],
                                    storage: config.storage.url,
                                    user: req.session.user,
    								params: req.params
    							}
    						});
    					}
    					else res.send('Gallery does not exist!');
    				}
    				else res.send('User does not exist!');
//    				db.close();
    			});
    		});
//    	});
    }
});

app.post('/:user/:gallery/upsert', function(req, res) {
    console.log('Coords update');
    var user = req.params.user.toLowerCase();
    if(req.session.user==user) {
//    	db.open(function(err, db) {
    		db.collection('users', function(err, collection) {
    			collection.findOne({
    				"user": user
    			}, function(err, document) {
    				var gal = document.galleries[req.params.gallery];
    				var p = 0;
    				for (var i in gal) {
    					if (gal[p].source.split('/').pop().replace('.jpg', '').replace('.png', '') == req.body.image.replace('.jpg', '').replace('.png', '')) {
    						break;
    					}
    					else {
    						p += 1;
    					}
    				}
    				//gal[p].source = '/images/' + req.body.image;
    				gal[p].top = req.body.top;
    				gal[p].left = req.body.side;
    				gal[p].width = req.body.width;
    				gal[p].height = req.body.height;
    				gal[p].z = req.body.z;
    				document.galleries[req.params.gallery] = gal;
    				collection.update({
    					"user": user
    				}, document, {
    					upsert: true,
    					safe: true
    				}, function(err, document) {
//    					db.close();
    				});
    				res.send(200, {success:true});
    			});
    		});
//    	});
    } else {
        res.send(400, 'Sorry, but you do not have access to update coordinates for this gallery.');
    }
});

app.post('/:user/:gallery/updateLink', function(req, res) {
    console.log('Link update');
    console.log(req.body.link);
    var user = req.params.user.toLowerCase();
    if((req.session.user==user) && (req.body.link!='null')) {
//        db.open(function(err, db) {
    		db.collection('users', function(err, collection) {
    			collection.findOne({
    				"user": user
    			}, function(err, document) {
    				var gal = document.galleries[req.params.gallery];
    				var p = 0;
    				for (var i in gal) {
    					if (gal[p].source.split('/').pop() == req.body.file) {
    						break;
    					}
    					else {
    						p += 1;
    					}
    				}
    				gal[p].link = req.body.link;
    				document.galleries[req.params.gallery] = gal;
    				collection.update({
    					"user": user
    				}, document, {
    					upsert: true,
    					safe: true
    				}, function(err, document) {
//    					db.close();
    				});
    				res.redirect('back');
    			});
    		});
//    	});
    } else {
        res.redirect('back');
    }
});

app.post('/:user/:gallery/photos/delete', function(req, res) {
    console.log('delete photo ' + req.body.file + ' by ' + req.params.user + ' from gallery ' + req.params.gallery);
    var user = req.params.user.toLowerCase();
    if(req.session.user===user) {
//    	db.open(function(err, db) {
    		db.collection('users', function(err, collection) {
    			collection.findOne({
    				"user": user
    			}, function(err, document) {
    				var gal = document.galleries[req.params.gallery];
    				var p = 0;
    				for (var i in gal) {
    					if (gal[p].source.split('/').pop().replace('.jpg', '').replace('.png', '') == req.body.file.replace('.jpg', '').replace('.png', '')) {
    						break;
    					}
    					else {
    						p += 1;
    					}
    				}
    				var pp = 0;
    				while (true) {
    					if (pp >= p) {
    						if (gal[pp + 1]) {
    							gal[pp] = gal[pp + 1];
    							delete gal[pp + 1];
    							pp += 1;
    						}
    						else {
    							if (pp == p) delete gal[pp];
    							break;
    						}
    					}
    					else {
    						pp += 1;
    					}
    				}
    				document.galleries[req.params.gallery] = gal;
    				collection.update({
    					"user": user
    				}, document, {
    					upsert: true,
    					safe: true
    				}, function(err, document) {
//    					db.close();
    				});
    				res.redirect('back');
    			});
    		});
//    	});
    } else {
        res.send(400, 'Sorry, but you do not have access to delete photos from this gallery.');
    }
});

app.get('/:user/:gallery/delete', function(req, res) {
    var user = req.session.user.toLowerCase();
    if(req.session.user==user) {
        var gallery = req.params.gallery.toLowerCase();
//    	db.open(function(err, db) {
    		db.collection('users', function(err, collection) {
    			collection.findOne({
    				"user": user
    			}, function(err, document) {
    				var gals = document.galleries;
    				for (var i in gals) {
    					if (i == gallery) delete gals[i];
    				}
    				document.galleries = gals;
    				collection.update({
    					"user": user
    				}, document, {
    					upsert: true,
    					safe: true
    				}, function(err, document) {
                    	db.collection('users_public', function(err, collection) {
                    		collection.findOne({
                    			"user": user
                    		}, function(err, document) {
                    			var gals = document.galleries;
                    			for (var i in gals) {
                    				if (i == gallery) delete gals[i];
                    			}
                    			document.galleries = gals;
                    			collection.update({
                    				"user": user
                    			}, document, {
                    				upsert: true,
                    				safe: true
                    			}, function(err, document) {
//                    				db.close();
                    			});
                    			res.send(200, {success:true});
                    		});
                    	});
    				});
    			});
    		});
//    	});
    } else {
        res.send(400, 'Sorry, but it looks like you are not logged in.');
    }
});

//app.get('/:user/galleries/list', function(req, res) {
//	db.open(function(err, db) {
//		db.collection('users', function(err, collection) {
//			collection.findOne({
//				"user": req.params.user
//			}, function(err, document) {
//				var galleries = new Array();
//				var c = 0;
//				for (var i in document.galleries) {
//					galleries[c] = '/' + req.params.user + '/' + i;
//					c += 1;
//				}
//				res.render('galleries', {
//					layout: false,
//					data: {
//						"galleries": galleries,
//						"user": req.params.user
//					}
//				});
//				db.close();
//			});
//		});
//	});
//});

app.get('/users/list/account/delete/:user', function(req, res) {
    console.log('delete user ' + req.params.user);
    var user = req.params.user.toLowerCase();
    if(req.session.user==user) {
//        db.open(function(err, db) {
    		db.collection('users', function(err, collection) {
    			collection.findOne({
    				"user": user
    			}, function(err, document) {
    				collection.remove({
        				"user": user
    				}, function(err, document) {
                    	db.collection('users_public', function(err, collection) {
                			collection.findOne({
                				"user": user
                			}, function(err, document) {
                				collection.remove({
                    				"user": user
                				}, function(err, document) {
//                                	db.close();
                                    req.session.user = '';
                                    req.session.password = '';
                                    res.send(200, {success:true});
                				});
                			});
                		});
    				});
    			});
    		});
//    	});
    } else {
        res.send(400, 'Sorry, but you do not have access to delete this user account.');
    }
});

app.post('/:user/galleries/new', function(req, res) {
    console.log('new gallery');
    var gallery = req.body.gallery.toLowerCase();
    if(req.session.user) {
//    	db.open(function(err, db) {
    		db.collection('users', function(err, collection) {
    			collection.findOne({
    				"user": req.session.user
    			}, function(err, document) {
    				if (!document.galleries[gallery]) {
    					var data = 'iVBORw0KGgoAAAANSUhEUgAABp0AAAQfCAYAAADhpCFVAABAAElEQVR4AezZsQ0AIAwEMWCl7D8bSKxwrelJYX13e2bu8ggQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgEgRP++kqAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEDgC4hOhkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zovolSXwAAQABJREFUAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgAABAgQIECBAgAABAgQIECCQBUSnTOgAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6GQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECWUB0yoQOECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIiE42QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgkAVEp0zoAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAgOhkAwQIECBAgAABAgQIECBAgAABAgQIECBAgAABAllAdMqEDhAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhONkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQIJAFRKdM6AABAgQIECBAgAABAgQIECBAgAABAgQIECBAgIDoZAMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJZQHTKhA4QIECAAAECBAgQIECAAAECBAgQIECAAAECBAiITjZAgAABAgQIECBAgACB154d0gAAADAM8+96IkZr4KA5GwECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAATKI1iAAAALxSURBVAIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AKi0yY0QIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgIDr5AAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwBYQnTahAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAdHJBwgQIECAAAECBAgQIECAAAECBAgQIECAAAECBLaA6LQJDRAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECIhOPkCAAAECBAgQIECAAAECBAgQIECAAAECBAgQILAFRKdNaIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQEB08gECBAgQIECAAAECBAgQIECAAAECBAgQIECAAIEtIDptQgMECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQKikw8QIECAAAECBAgQIECAAAECBAgQIECAAAECBAhsAdFpExogQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAQnXyAAAECBAgQIECAAAECBAgQIECAAAECBAgQIEBgC4hOm9AAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQICA6OQDBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECW0B02oQGCBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIERCcfIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQ2AIBO78J1qeCFMMAAAAASUVORK5CYII=';
    					var buf = new Buffer(data, 'base64');
                        var p = __dirname + '/images/' + req.params.user + '-' + gallery + '-bg.png';
//    					fs.writeFile(p, buf, null, function(err) {
//                            fs.readFile(p, function (err, imageData) {
//                                if (err) throw err;
//                                request.post({
//                                        headers: {'Content-Type': 'image/png'},
//                                        url: config.storage.url + p.split('/').pop(),
//                                        body: imageData
//                                    }, function(error, response, body) {	
//					
//                                });
//                            });
//                        });
                        db.collection('images', function(err, collection) {
                            collection.update({
                                "name": p.split('/').pop()
                            }, {
                                "name": p.split('/').pop(),
                                "data": data
                            }, {
                                upsert: true,
                                safe: true
                            }, function(err, document) {
                                
                            });
                        });
    					var gal = new Object();
    					document.galleries[gallery] = gal;
    					collection.update({
    						"user": req.session.user
    					}, document, {
    						upsert: true,
    						safe: true
    					}, function(err, document) {
//    						db.close();
    					});
    				}
    				res.send(200, {success:true});
    			});
    		});
//    	});
    } else {
        res.send(400, 'Sorry, but it appears you are not logged in.');
    }
});

app.post('/users/list/new', function(req, res) {
    console.log('New user ' + req.body.user);
    var user = req.body.user.toLowerCase();
//	db.open(function(err, db) {
		db.collection('users', function(err, collection) {
			collection.findOne({
				"user": user
			}, function(err, document) {
				if (!document) {
					document = new Object();
					document.user = user;
                    document.email = req.body.email;
                    document.password = crypto.createHash('md5').update(req.body.password).digest("hex");
					document.galleries = {};
					collection.update({
						"user": user
					}, document, {
						upsert: true,
						safe: true
					}, function(err, document) {
                        db.collection('users_public', function(err, collection) {
                    		collection.findOne({
                				"user": user
                			}, function(err, document) {
                				if (!document) {
                					document = new Object();
                					document.user = user;
                                    document.email = req.body.email;
                                    document.password = req.body.password;
                					document.galleries = {};
                					collection.update({
                						"user": user
                					}, document, {
                						upsert: true,
                						safe: true
                					}, function(err, document) {
                                        req.session.user = user;
                                        //req.session.password = req.body.password;
//                						db.close();
                                        res.send(200, {success:true});
                					});
                				} else {
                                    res.redirect(400, 'User already exists!');
                				}
                			});
                		});
					});
				} else {
                    res.send(400, 'User already exists!');
				}
			});
		});
//	});
    //Send e-mail to admin
    // create reusable transport method (opens pool of SMTP connections)
    var epwd = process.env.EMAIL_PWD || config.email.password;
    var smtpTransport = nodemailer.createTransport("SMTP",{
        service: "Gmail",
        auth: {
            user: config.email.username,
            pass: epwd
        }
    });
    // setup e-mail data with unicode symbols
    var mailOptions = {
        from: "Photo Admin <kristsauders@gmail.com>", // sender address
        to: "kristsauders@gmail.com", // list of receivers
        subject: "New User Signed Up", // Subject line
        text: "A new user named " + user + " signed up at photo.kristsauders.com with the email " + req.body.email, // plaintext body
    }
    // send mail with defined transport object
    smtpTransport.sendMail(mailOptions, function(error, response){
        if(error){
            console.log(error);
        }else{
            console.log("Message sent: " + response.message);
        }
    
        smtpTransport.close(); // shut down the connection pool, no more messages
    });
});

app.post('/users/list/login', function(req, res) {
    console.log('Login by ' + req.body.user);
    var user = req.body.user.toLowerCase();
    if(user.length>0) {
//        db.open(function(err, db) {
    		db.collection('users', function(err, collection) {
    			collection.findOne({
    				"user": user
    			}, function(err, document) {
                    if(document) {
        				if(document.password == crypto.createHash('md5').update(req.body.password).digest("hex")) {
                            req.session.user = user;
                            //req.session.password = req.body.password;
                            if(req.body.form) res.redirect('back');
        	                else res.send(200, {success:true});
                            console.log('Correct Password');
        				} else {
                            console.log('Wrong Password');
                            if(req.body.form) res.redirect('back');
                            else res.send(400, 'Wrong password!');
        				}
    //    				db.close();
                    } else {
                        res.redirect('back');
                    }
    			});
    		});
//    	});
    }
});

app.post('/users/list/password', function(req, res) {
    console.log('Password change by ' + req.body.user);
    var user = req.body.user.toLowerCase();
    if(user.length>0) {
//        db.open(function(err, db) {
        	db.collection('users', function(err, collection) {
    			collection.findOne({
    				"user": user
    			}, function(err, document) {
    				if(document.password == crypto.createHash('md5').update(req.body.password).digest("hex")) {
                        document.password = crypto.createHash('md5').update(req.body.newPassword).digest("hex");
                        //req.session.password = req.body.password;
                        collection.update({
                        		"user": user
                    		}, document, {
                    			upsert: true,
                    			safe: true
                    		}, function(err, document) {
                                req.session.user = user;
                                res.send(200);
                                //req.session.password = req.body.password;
//                    			db.close();
                		});
    				} else {
                        console.log('Wrong Password');
                        res.send(400, 'Wrong password!');
    				}
    				//db.close();
    			});
    		});
//    	});
    }
});

app.post('/users/list/logout', function(req, res) {
    console.log('Logout by ' + req.session.user);
    req.session.user = '';
    req.session.password = '';
    if(req.body.form) res.redirect('/');
    else res.send(200, {success:true});
});

app.get('/', function(req, res) {
    res.redirect('/home/users');
});

//app.get('/admin', function(req, res) {
//	db.open(function(err, db) {
//		db.collection('users', function(err, collection) {
//			collection.find().toArray(function(err, document) {
//				var users = new Array();
//				for (var i = 0; i < document.length; i++) {
//					users[i] = document[i].user;
//				}
//				res.render('users', {
//					layout: false,
//					data: users
//				});
//				db.close();
//			});
//		});
//	});
//});

app.get('/fbauth', function(req, res) {
    console.log('Got request');
	var appId = "151679494937877";    
	var appSecret = "1e919b67ac456f708d5827576e3dd2fa";    
	var myUrl = "http://code.kristsauders.com:8085/fbauth";

	var code = url.parse(req.url, true).query.code;

	    
	if (!code) {        
		var dialogUrl = "http://www.facebook.com/dialog/oauth?scope=user_photos&client_id=" + appId + "&redirect_uri=" + encodeURIComponent(myUrl);   
        console.log('Redirecting to FBauth at ' + dialogUrl);
        res.redirect(dialogUrl);
		return;    
	}

    console.log('Got request with code ' + code);
	rest.get("https://graph.facebook.com/oauth/access_token?client_id=" + appId + "&redirect_uri=" + encodeURIComponent(myUrl) + "&client_secret=" + appSecret + "&code=" + code).on('complete', function(data) {
		console.log('Got response from Facebook: ' + data);
        req.session.token = data;
		res.redirect('/fbphotos');
	});
});

app.get('/fbphotos', function(req, res) {
	rest.get("https://graph.facebook.com/me?" + req.session.token).on('complete', function(data) {
        console.log(data[0]);
        console.log('User name is ' + data[0].name + ' and user ID is ' + data[0].id);
        rest.get("https://graph.facebook.com/" + data.id + "/albums?" + req.session.token).on('complete', function(data) {
            console.log(data);
//		var b = "";
//		for (var i in data) {
//			b += '<br/>' + data[i].name + ' ' + data[i].id + ' <img src="' + data[i]['cover_photo'] + '"/>';
//		}
            res.send(data);
        });
//		res.render('index', {
//            layout: false,
//            data: photos
//            });
	});
});

app.get('/fbtest', function(req, res) {
    rest.get("https://graph.facebook.com/me?access_token=AAACJ86JqXRUBAPzXmsaCNiZBttPxVLOtbw9P5zTJDpHjzUgu7vMS9zHpvbVE4FFXAPBVsEXFnK4DSF6uYEZCBZCbaSTIgZA9GzPgs9DoqlEBWYE63UhE").on('complete', function(data) {
        var r = JSON.parse(data);
        //console.log(r);
        console.log('User name is ' + r.name + ' and user ID is ' + r.id);
        rest.get("https://graph.facebook.com/" + r.id + "/albums?access_token=AAACJ86JqXRUBAPzXmsaCNiZBttPxVLOtbw9P5zTJDpHjzUgu7vMS9zHpvbVE4FFXAPBVsEXFnK4DSF6uYEZCBZCbaSTIgZA9GzPgs9DoqlEBWYE63UhE").on('complete', function(data) {
            var p = JSON.parse(data);
            var b = "";
            for (var i in p.data) {
            	b += '<br/>' + p.data[i].name + ' ' + p.data[i].id + ' <img src="https://graph.facebook.com/' + p.data[i].id + '/picture?type=small&access_token=AAACJ86JqXRUBAPzXmsaCNiZBttPxVLOtbw9P5zTJDpHjzUgu7vMS9zHpvbVE4FFXAPBVsEXFnK4DSF6uYEZCBZCbaSTIgZA9GzPgs9DoqlEBWYE63UhE">';
            }
            res.send(b);
        });
	});
});

app.get('/fbtest2', function(req, res) {
    rest.get("https://graph.facebook.com/me?access_token=AAACJ86JqXRUBAPzXmsaCNiZBttPxVLOtbw9P5zTJDpHjzUgu7vMS9zHpvbVE4FFXAPBVsEXFnK4DSF6uYEZCBZCbaSTIgZA9GzPgs9DoqlEBWYE63UhE").on('complete', function(data) {
        var r = JSON.parse(data);
        //console.log(r);
        console.log('User name is ' + r.name + ' and user ID is ' + r.id);
        rest.get("https://graph.facebook.com/" + r.id + "/albums?access_token=AAACJ86JqXRUBAPzXmsaCNiZBttPxVLOtbw9P5zTJDpHjzUgu7vMS9zHpvbVE4FFXAPBVsEXFnK4DSF6uYEZCBZCbaSTIgZA9GzPgs9DoqlEBWYE63UhE").on('complete', function(data) {
            var p = JSON.parse(data);
            rest.get("https://graph.facebook.com/" + p.data[0].id + "/photos?access_token=AAACJ86JqXRUBAPzXmsaCNiZBttPxVLOtbw9P5zTJDpHjzUgu7vMS9zHpvbVE4FFXAPBVsEXFnK4DSF6uYEZCBZCbaSTIgZA9GzPgs9DoqlEBWYE63UhE").on('complete', function(data) {
                var k = JSON.parse(data);
                var b = "";
                for (var i in k.data) {
                    console.log(k.data[i].images[0].source);
                    b += '<br/><img src="' + k.data[i].images[0].source + '">';
                }
                res.send(b);
            });
        });
	});
});

app.listen(config.app.prt);
console.log('Started up successfully.');
