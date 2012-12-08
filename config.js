var config = {}

config.db = {};
config.im = {};
config.email = {};
config.app = {};
config.storage = {};

config.db.url = '127.0.0.1';
config.db.prt = 27017;
config.db.name = 'tabletop';
config.db.username = '';
config.db.pwd = '';
config.im.identify = '/usr/bin/identify';
config.im.convert = '/usr/bin/convert';
config.email.username = 'kristsauders@gmail.com';
config.email.password = '';
config.app.prt = 8080;

// Base URL for storing and displaying images. Make sure to use a trailing slash.
//config.storage.url = 'http://riak.kristsauders.com/buckets/images/keys/';
config.storage.url = '/images/';

// OSX ImageMagick paths
//config.im.identify = '/opt/local/bin/identify';
//config.im.convert = '/opt/local/bin/convert';

module.exports = config;
