
function loginSuccess(response) {
    setTimeout(function(){window.location.reload(true);}, 1000);
}
    
function submitLogin(user, password) {
    var data = new Object();
    data.user = user;
    data.password = password;
    if(data.password) {
        $.ajax({
           type: 'POST',
           url: '/users/list/login',
           data: data,
           success: function(response){
               loginSuccess(response);
           },
           error: function(jqXHR, textStatus, errorThrown){
               alert(JSON.stringify(jqXHR.responseText));
           },
           dataType: 'json'
        });
    }
}

function login() {
    $("\
        <form id='login' align='center'>\
            <fieldset>\
                <label for='name'>Username</label>\
                <input type='text' name='name' id='name' class='text ui-widget-content ui-corner-all' /><br/>\
                <label for='password'>Password</label>\
                <input type='password' name='password' id='password' value='' class='text ui-widget-content ui-corner-all' /><br/>\
                <input type='submit' style='visibility:hidden;' />\
            </fieldset>\
        </form>\
    ").dialog({
        title: "Login",
    	modal:true,
    	height:350,
    	width:600,
    	buttons: {
    		"Log in": function() {
    			submitLogin($("#name").val(), $("#password").val());
    			$(this).dialog( "destroy" );
    			$(this).remove();
    		},
    		Cancel: function() {
    			$(this).dialog( "destroy" );
    			$(this).remove();
    		},
    	},
    	close: function() {
    		$(this).dialog( "destroy" );
    		$(this).remove();
    	}
    });
    $("#login").submit(function(e){
    	e.preventDefault();
    	submitLogin($("#name").val(), $("#password").val());
    	$(this).dialog( "destroy" );
    	$(this).remove();
    });
}

function changePasswordSuccess() {
    setTimeout(function(){window.location.reload(true);}, 1000);
}
    
function submitChangePassword(user, password, newPassword, newPasswordConfirm) {
    var data = new Object();
    data.user = user;
    data.password = password;
    data.newPassword = newPassword;
    data.newPasswordConfirm = newPasswordConfirm;
    if((data.password) && (data.newPassword==data.newPasswordConfirm)) {
        $.ajax({
           type: 'POST',
           url: '/users/list/password',
           data: data,
           success: function(response){
               changePasswordSuccess();
           },
           error: function(jqXHR, textStatus, errorThrown){
               alert(JSON.stringify(jqXHR.responseText));
           },
           dataType: 'json'
        });
    } else {
        alert('You entered something incorrectly, please try again!');
    }
}

function changePassword() {
    $("\
        <form id='login' align='center'>\
            <fieldset>\
                <label for='name'>Username</label>\
                <input type='text' name='name' id='name' class='text ui-widget-content ui-corner-all' /><br/>\
                <label for='password'>Password</label>\
                <input type='password' name='password' id='password' value='' class='text ui-widget-content ui-corner-all' /><br/>\
                <label for='newPassword'>New Password</label>\
                <input type='password' name='newPassword' id='newPassword' value='' class='text ui-widget-content ui-corner-all' /><br/>\
                <label for='newPasswordConfirm'>Confirm New Password</label>\
                <input type='password' name='newPasswordConfirm' id='newPasswordConfirm' value='' class='text ui-widget-content ui-corner-all' /><br/>\
                <input type='submit' style='visibility:hidden;' />\
            </fieldset>\
        </form>\
    ").dialog({
        title: "Change Password",
        modal:true,
    	height:400,
    	width:600,
    	buttons: {
    		"Change Password": function() {
    			submitChangePassword($("#name").val(), $("#password").val(), $("#newPassword").val(), $("#newPasswordConfirm").val());
    			$(this).dialog( "destroy" );
    			$(this).remove();
    		},
    		Cancel: function() {
    			$(this).dialog( "destroy" );
    			$(this).remove();
    		},
    	},
    	close: function() {
    		$(this).dialog( "destroy" );
    		$(this).remove();
    	}
    });
    $("#login").submit(function(e){
    	e.preventDefault();
    	submitChangePassword($("#name").val(), $("#password").val(), $("#newPassword").val(), $("#newPasswordConfirm").val());
    	$(this).dialog( "destroy" );
    	$(this).remove();
    });
}

function logoutSuccess() {
        setTimeout(function(){window.location = '/';});
    }

function logout() {
    $.ajax({
       type: 'POST',
       url: '/users/list/logout',
       data: '',
       success: logoutSuccess(),
       dataType: 'json'
    });
}

var ddpp=null;
function getScrollXY() {
      var scrOfX = 0, scrOfY = 0;
	  if( typeof( window.pageYOffset ) == 'number' ) {
	    //Netscape compliant
	    scrOfY = window.pageYOffset;
	    scrOfX = window.pageXOffset;
	  } else if( document.body && ( document.body.scrollLeft || document.body.scrollTop ) ) {
	    //DOM compliant
	    scrOfY = document.body.scrollTop;
	    scrOfX = document.body.scrollLeft;
	  } else if( document.documentElement && ( document.documentElement.scrollLeft || document.documentElement.scrollTop ) ) {
	    //IE6 standards compliant mode
	    scrOfY = document.documentElement.scrollTop;
	    scrOfX = document.documentElement.scrollLeft;
	  }
	  return [ scrOfX, scrOfY ];
	}
function get_cookie(Name) {
	  var search = Name + "="
	  var returnvalue = "";
	  if (document.cookie.length > 0) {
	    offset = document.cookie.indexOf(search)
	    // if cookie exists
	    if (offset != -1) { 
	      offset += search.length
	      // set index of beginning of value
	      end = document.cookie.indexOf(";", offset);
	      // set index of end of cookie value
	      if (end == -1) end = document.cookie.length;
	      returnvalue=unescape(document.cookie.substring(offset, end))
	      }
	   }
	  return returnvalue;
	}
function pageScroll() {
	var scrollY = get_cookie("scrollY");
	var scrollX = get_cookie("scrollX");
	window.scrollBy(scrollX,scrollY); 
}

function setPageScroll() {
	var exp = new Date( );
	var nowPlus = exp.getTime( ) + (5000);
	exp.setTime(nowPlus);
	document.cookie = "scrollY=" + getScrollXY()[1] + "; expires=" + exp.toGMTString( );
	document.cookie = "scrollX=" + getScrollXY()[0] + "; expires=" + exp.toGMTString( );
}
function showUpload() {
	document.getElementById("upload").style.visibility = 'visible';
	if(!document.getElementById("overlay")){
		x = document.getElementsByTagName("img");
		for (i=0;i<x.length;i++)
		{
			x[i].style.visibility = 'hidden';
		}
	} else {
		document.getElementById("overlay").style.visibility = 'visible';
	}
}
function hideUpload() {
	document.getElementById("upload").style.visibility = 'hidden';
	if(!document.getElementById("overlay")){
		x = document.getElementsByTagName("img");
		for (i=0;i<x.length;i++)
		{
			x[i].style.visibility = 'visible';
		}
	} else {
	document.getElementById("overlay").style.visibility = 'hidden';
	}
}
function showLinkUpload() {
	document.getElementById("uploadLink").style.visibility = 'visible';
	if(!document.getElementById("overlay")){
		x = document.getElementsByTagName("img");
		for (i=0;i<x.length;i++)
		{
			x[i].style.visibility = 'hidden';
		}
	} else {
		document.getElementById("overlay").style.visibility = 'visible';
	}
}
function hideLinkUpload() {
	document.getElementById("uploadLink").style.visibility = 'hidden';
	if(!document.getElementById("overlay")){
		x = document.getElementsByTagName("img");
		for (i=0;i<x.length;i++)
		{
			x[i].style.visibility = 'visible';
		}
	} else {
	document.getElementById("overlay").style.visibility = 'hidden';
	}
}
    function getWindowSize() {
         var viewportwidth;
         var viewportheight;
        
         if (typeof window.innerWidth != 'undefined')
         {
              viewportwidth = window.innerWidth;
              viewportheight = window.innerHeight;
         } else if (typeof document.documentElement != 'undefined'
             && typeof document.documentElement.clientWidth !=
             'undefined' && document.documentElement.clientWidth != 0)
         {
               viewportwidth = document.documentElement.clientWidth;
               viewportheight = document.documentElement.clientHeight;
         } else {
               viewportwidth = document.getElementsByTagName('body')[0].clientWidth;
               viewportheight = document.getElementsByTagName('body')[0].clientHeight
         }
         if(viewportwidth==0) {
        	 viewportwidth = document.getElementsByTagName('body')[0].clientWidth;}
         if(viewportheight==0) {
             viewportheight = document.getElementsByTagName('body')[0].clientWidth;}
         return [viewportwidth, viewportheight];
	}
function resizeFirst() {
    x = document.getElementsByTagName("img");
	var viewportwidth = getWindowSize()[0];
	for (i=0;i<x.length;i++)
	{
        if(x[i].id=="background") continue;
		x[i].style.width = x[i].width*(viewportwidth/1366)+"px";
        if(x[i].style.height)
		    x[i].style.height = x[i].height*(viewportwidth/1366)+"px";
		x[i].style.left = parseInt(x[i].style.left)*(viewportwidth/1366)+"px";
		x[i].style.top = parseInt(x[i].style.top)*(viewportwidth/1366)+"px";
	}
}

function showDelete() {
	x = document.getElementsByTagName("img");
	for (i=0;i<x.length;i++)
	{
	if(x[i]) {
    	var element = document.createElement("input");
    	element.setAttribute("type","button");
    	element.setAttribute("value","x");
    	element.setAttribute("onclick","javascript:deleteImage(this)");
    	element.onclick = function() {deleteImage(this);};
    	element.style.position = 'absolute';
    	element.style.left = '0px';
    	element.style.top = '0px';
        element.setAttribute("class", 'delX');
    	x[i].parentNode.appendChild(element);
	}
    setTimeout(function(){ hideDelete(); }, 6000);
}
//	document.getElementById("adminDeleteButton").onclick = hideDelete;
//	document.getElementById("adminDeleteButton").value = "Done deleting";
	
}

function hideDelete() {
    $('.delX').remove();
//	x = document.getElementsByTagName("img");
//	for (i=0;i<x.length;i++)
//	{
//		if(x[i]) {
//			x[i].parentNode.removeChild(x[i].parentNode.firstChild);
//		}
//    }
//	document.getElementById("adminDeleteButton").onclick = showDelete;
//	document.getElementById("adminDeleteButton").value = "Delete image";
}

 function fullScreen(el) {
	 if(document.getElementById(el.src.split("/").pop().replace('-small','').replace('-medium','').replace('-large','')+"link")) {
		 var linkObj = document.getElementById(el.src.split("/").pop().replace('-small','').replace('-medium','').replace('-large','')+"link");
         var t = '';
		 if(linkObj.innerText){
			 t = linkObj.innerText;
		 } else if(linkObj.textContent) {
			 t = linkObj.textContent;
		 }
         if(t.indexOf('javascript:')==-1) {
             window.location = t;
         } else {
             eval(t);
         }
	 } else {
        var hiResImg = new Image();
        hiResImg.src = el.src.substring(0,el.src.lastIndexOf('-')) + '-large' + el.src.substring(el.src.lastIndexOf('.'));
        if(!hiResImg.complete) {
            document.getElementById("fullScreenImage").src = el.src;
        } else {
            if((document.getElementById("fullScreenImage").style.visibility=='visible') && (document.getElementById("fullScreenImage").src==el.src)) {
                 document.getElementById("fullScreenImage").src = hiResImg.src;
            }
        }
        var ih = el.height;
        var iw = el.width;
        document.getElementById("fullScreenImage").style.width = getWindowSize()[0] + 'px';
           var rs = getWindowSize()[1]/getWindowSize()[0];
           var ri = ih/iw;
           var rsi = rs/ri;
           if(rsi>1) {
               document.getElementById("fullScreenImg").style.width = 0.9*getWindowSize()[0] + 'px';
               document.getElementById("fullScreenImg").style.left = 0.05*getWindowSize()[0] + 'px';
               document.getElementById("fullScreenImage").style.width = 0.9*getWindowSize()[0] + 'px';
           } else {
               var rsic = rsi*0.9*getWindowSize()[0];
               document.getElementById("fullScreenImg").style.width = rsic + 'px';
               document.getElementById("fullScreenImg").style.left = (getWindowSize()[0]-rsic)/2 + 'px';
               document.getElementById("fullScreenImage").style.width = rsic + 'px';
           }

       if(document.getElementById("overlay")){
       		document.getElementById("overlay").style.visibility = 'visible';
       }
       if(document.getElementById("fullScreenImage").complete) {
           document.getElementById("closeFullscreenButton").style.visibility = 'visible';
           document.getElementById("fullScreenImg").style.visibility = 'visible';
           document.getElementById("fullScreenImage").style.visibility = 'visible';
       }
       document.getElementById("fullScreenImage").onload = function() {
               document.getElementById("closeFullscreenButton").style.visibility = 'visible';
               document.getElementById("fullScreenImg").style.visibility = 'visible';
               document.getElementById("fullScreenImage").style.visibility = 'visible';
       }
       hiResImg.onload = function() {
           setTimeout(function() {
               if((document.getElementById("fullScreenImage").style.visibility=='visible') && (document.getElementById("fullScreenImage").src==el.src)) {
                   document.getElementById("fullScreenImage").src = hiResImg.src;
               }
           }, 100);
       }
//        ddpp = dd;
//        dd.obj=null;
//        dd.evt=function(d_e) {};
     }
}

function closeFullscreen() {
//    dd=ddpp;
//    dd.evt = function(d_e)
//    {
//        this.but = (this.e = d_e || window.event).which || this.e.button || 0;
//        this.button = (this.e.type == 'mousedown')? this.but
//    		: (dd.e && dd.e.button)? dd.e.button
//    		: 0;
//    	this.src = this.e.target || this.e.srcElement || null;
//    	this.src.tag = ("" + (this.src.tagName || this.src)).toLowerCase();
//    	this.x = dd.Int(this.e.pageX || this.e.clientX || 0);
//    	this.y = dd.Int(this.e.pageY || this.e.clientY || 0);
//    	if(dd.ie)
//    	{
//    		this.x += dd.getScrollX() - (dd.ie && !dd.iemac)*1;
//    		this.y += dd.getScrollY() - (dd.ie && !dd.iemac)*1;
//    	}
//    	//this.modifKey = this.e.modifiers? this.e.modifiers&Event.SHIFT_MASK : (this.e.shiftKey || false);
//    	if((this.but==3) || (this.but==2)){
//    		this.modifKey = true;
//    	} else {
//    		this.modifKey = false;
//    	}
//    };
	document.getElementById("fullScreenImage").style.visibility = 'hidden';
   document.getElementById("fullScreenImg").style.visibility = 'hidden';
   if(document.getElementById("overlay")){
   		document.getElementById("overlay").style.visibility = 'hidden';
   }
   document.getElementById("closeFullscreenButton").style.visibility = 'hidden';
}

function success() {
    
}

function hideLinkUpdate() {
    $('.delLinkX').remove();
//    x = document.getElementsByTagName("img");
//	for (i=0;i<x.length;i++)
//	{
//		if(x[i].name.split("jpgdivNI")[1]=="mG" || x[i].name.split("pngdivNI")[1]=="mG") {
//			x[i].parentNode.removeChild(x[i].parentNode.lastChild);
//		}
//    }
//	document.getElementById("updateLinkButton").onclick = showLinkUpdate;
//	document.getElementById("updateLinkButton").value = "Update Image Link";
}

function showLinkUpdate() {
    x = document.getElementsByTagName("img");
	for (i=0;i<x.length;i++)
	{
    	if(x[i]) {
    	var element = document.createElement("input");
    	element.setAttribute("type","button");
    	element.setAttribute("value","This");
    	element.setAttribute("onclick","javascript:updateLink(this)");
    	element.onclick = function() {updateLink(this);};
    	element.style.position = 'absolute';
    	element.style.left = '0px';
    	element.style.top = '0px';
        element.setAttribute("class", "delLinkX");
    	x[i].parentNode.appendChild(element);
    	}
    }
    setTimeout(function() { hideLinkUpdate(); }, 6000);
//	document.getElementById("updateLinkButton").onclick = hideLinkUpdate;
//	document.getElementById("updateLinkButton").value = "Cancel";
	
}

function shortClick(src) {
	alert(src);
}
function fullScreenButton(el) {
	var fullScreenButton = document.createElement("img");
	fullScreenButton.setAttribute("id", "fullScreenButton");
	fullScreenButton.setAttribute("src","/images/upArrow.png");
	el.parentNode.appendChild(fullScreenButton);
	fullScreenButton = document.getElementById("fullScreenButton");
	fullScreenButton.style.position = 'absolute';
	fullScreenButton.style.left = '0px';
	fullScreenButton.style.top = '0px';
	fullScreenButton.style.width = el.width*0.05+"px";
	fullScreenButton.style.height = fullScreenButton.style.width;
	fullScreenButton.style.visibility = 'visible';
	
	var fullScreenButton2 = document.createElement("img");
	fullScreenButton2.setAttribute("id", "fullScreenButton2");
	fullScreenButton2.setAttribute("src","/images/downArrow.png");
	el.parentNode.appendChild(fullScreenButton2);
	fullScreenButton2 = document.getElementById("fullScreenButton2");
	fullScreenButton2.style.position = 'absolute';
	fullScreenButton2.style.right = '0px';
	fullScreenButton2.style.bottom = '0px';
	fullScreenButton2.style.width = el.width*0.05+"px";
	fullScreenButton2.style.height = fullScreenButton2.style.width;
	fullScreenButton2.style.visibility = 'visible';
}
function deleteFullScreenButton(el) {
	var fullScreenButton = document.getElementById("fullScreenButton");
	fullScreenButton.parentNode.removeChild(fullScreenButton);
	var fullScreenButton2 = document.getElementById("fullScreenButton2");
	fullScreenButton2.parentNode.removeChild(fullScreenButton2);
}
function signupSuccess(user) {
        setTimeout(function(){
        	window.location = '/' + user;
    	}, 1000);
}
function submitSignup(user, email, password) {
    var data = new Object();
    data.user = user;
    data.email = email;
    data.password = password;
    if(data.password) {
        $.ajax({
           type: 'POST',
           url: '/users/list/new',
           data: data,
           success: function(response){
               signupSuccess(user.toLowerCase());
           },
           error: function(jqXHR, textStatus, errorThrown){
               alert(JSON.stringify(jqXHR.responseText));
           },
           dataType: 'json'
        });
    }
}
function signup() {
    $("\
        <form id='login' align='center'>\
            <fieldset>\
                <label for='name'>Username</label>\
                <input type='text' name='name' id='name' class='text ui-widget-content ui-corner-all' /><br/>\
                <label for='email'>Email</label>\
                <input type='text' name='email' id='email' class='text ui-widget-content ui-corner-all' /><br/>\
                <label for='password'>Password</label>\
                <input type='password' name='password' id='password' value='' class='text ui-widget-content ui-corner-all' /><br/>\
                <input type='submit' style='visibility:hidden;' />\
            </fieldset>\
        </form>\
    ").dialog({
        title: "Sign Up",
        modal:true,
    	height:350,
    	width:600,
    	buttons: {
    		"Sign Up": function() {
    			submitSignup($("#name").val(), $("#email").val(), $("#password").val());
    			$(this).dialog( "destroy" );
    			$(this).remove();
    		},
    		Cancel: function() {
    			$(this).dialog( "destroy" );
    			$(this).remove();
    		},
    	},
    	close: function() {
    		$(this).dialog( "destroy" );
    		$(this).remove();
    	}
    });
    $("#login").submit(function(e){
    	e.preventDefault();
    	submitSignup($("#name").val(), $("#email").val(), $("#password").val());
    	$(this).dialog( "destroy" );
    	$(this).remove();
    });
}
function deleteUserSuccess() {
        setTimeout(function(){
        	window.location = '/';
    	}, 1000);
        }
function submitDeleteAccount(user, password) {
    var data = new Object();
    data.user = user;
    data.password = password;
    if(confirm("Are you sure? This will delete your account!")) {
        if(data.password) {
            $.get(
               '/users/list/account/delete/' + data.user,
               function(data) {
        	        deleteUserSuccess();
                }
            );
        }
    }
}
function deleteAccount() {
    $("\
        <form id='login' align='center'>\
            <fieldset>\
                <label for='name'>Username</label>\
                <input type='text' name='name' id='name' class='text ui-widget-content ui-corner-all' /><br/>\
                <label for='password'>Password</label>\
                <input type='password' name='password' id='password' value='' class='text ui-widget-content ui-corner-all' /><br/>\
                <input type='submit' style='visibility:hidden;' />\
            </fieldset>\
        </form>\
    ").dialog({
        title: "Delete Account",
        modal:true,
        height:350,
    	width:600,
    	buttons: {
    		"Delete Account": function() {
    			submitDeleteAccount($("#name").val(), $("#password").val());
    			$(this).dialog( "destroy" );
    			$(this).remove();
    		},
    		Cancel: function() {
    			$(this).dialog( "destroy" );
    			$(this).remove();
    		},
    	},
    	close: function() {
    		$(this).dialog( "destroy" );
    		$(this).remove();
    	}
    });
    $("#login").submit(function(e){
    	e.preventDefault();
    	submitDeleteAccount($("#name").val(), $("#password").val());
    	$(this).dialog( "destroy" );
    	$(this).remove();
    });
}
function newGallerySuccess(user, gallery) {
        setTimeout(function(){
        	window.location = '/' + user + '/' + gallery;
    	}, 1000);
}
function submitNewGallery(gallery) {
    var data = new Object();
    //data.user = document.URL.split('#')[0].split('?')[0].split('/').pop();
    data.gallery = gallery;
    if(data.gallery) {
        $.ajax({
           type: 'POST',
           url: '/' + user.toLowerCase() + '/galleries/new',
           data: data,
           success: function(response){
               newGallerySuccess(user.toLowerCase(), data.gallery.toLowerCase());
           },
           error: function(jqXHR, textStatus, errorThrown){
               alert(JSON.stringify(jqXHR.responseText));
           },
           dataType: 'json'
        });
    }
}
function newGallery() {
    $("\
        <form id='login' align='center'>\
            <fieldset>\
                <label for='name'>Gallery Title</label>\
                <input type='text' name='gallery' id='gallery' class='text ui-widget-content ui-corner-all' /><br/>\
                <input type='submit' style='visibility:hidden;' />\
            </fieldset>\
        </form>\
    ").dialog({
        title: "Create Gallery",
        modal:true,
        height:200,
        width:600,
    	buttons: {
    		"Create Gallery": function() {
    			submitNewGallery($("#gallery").val());
    			$(this).dialog( "destroy" );
    			$(this).remove();
    		},
    		Cancel: function() {
    			$(this).dialog( "destroy" );
    			$(this).remove();
    		},
    	},
    	close: function() {
    		$(this).dialog( "destroy" );
    		$(this).remove();
    	}
    });
    $("#login").submit(function(e){
    	e.preventDefault();
    	submitNewGallery($("#gallery").val());
    	$(this).dialog( "destroy" );
    	$(this).remove();
    });
}
function deleteGallerySuccess(user) {
        setTimeout(function(){
        	window.location = '/' + user;
    	}, 1000);
        }
function submitDeleteGallery(gallery) {
    var data = new Object();
    //data.user = document.URL.split('#')[0].split('?')[0].split('/').pop();
    data.gallery = gallery;
    if(data.gallery) {
        $.get(
           '/' + user.toLowerCase() + '/' + data.gallery.toLowerCase() + '/delete',
           function() {
    	        deleteGallerySuccess(user.toLowerCase());
            }
        );
    }
}
function deleteGallery() {
    $("\
        <form id='login' align='center'>\
            <fieldset>\
                <label for='name'>Gallery Title</label>\
                <input type='text' name='gallery' id='gallery' class='text ui-widget-content ui-corner-all' /><br/>\
                <input type='submit' style='visibility:hidden;' />\
            </fieldset>\
        </form>\
    ").dialog({
        title: "Delete Gallery",
        modal:true,
        height:200,
        width:600,
        buttons: {
    		"Delete Gallery": function() {
    			submitDeleteGallery($("#gallery").val());
    			$(this).dialog( "destroy" );
    			$(this).remove();
    		},
    		Cancel: function() {
    			$(this).dialog( "destroy" );
    			$(this).remove();
    		},
    	},
    	close: function() {
    		$(this).dialog( "destroy" );
    		$(this).remove();
    	}
    });
    $("#login").submit(function(e){
    	e.preventDefault();
    	submitDeleteGallery($("#gallery").val());
    	$(this).dialog( "destroy" );
    	$(this).remove();
    });
}
function publishGallerySuccess() {
    setTimeout(function(){
        window.location = document.URL.split('#')[0].split('?')[0];
    }, 1000);
}
function publishGallery() {
    var data = new Object();
    $.ajax({
       type: 'POST',
       url: document.URL.split('#')[0].split('?')[0] + '/publish',
       data: data,
       success: function(response){
               publishGallerySuccess();
           },
        error: function(jqXHR, textStatus, errorThrown){
           alert(JSON.stringify(jqXHR.responseText));
        },
       dataType: 'json'
    });
}
function unpublishGallerySuccess() {
    setTimeout(function(){
        window.location = document.URL.split('#')[0].split('?')[0];
    }, 1000);
}
function unpublishGallery() {
    var data = new Object();
    $.ajax({
       type: 'POST',
       url: document.URL.split('#')[0].split('?')[0] + '/unpublish',
       data: data,
       success: function(response){
               unpublishGallerySuccess();
           },
        error: function(jqXHR, textStatus, errorThrown){
           alert(JSON.stringify(jqXHR.responseText));
        },
       dataType: 'json'
    });
}
function drawImage() {
    window.open(document.URL.split('#')[0].split('?')[0] + '/draw','_blank','location=0,width=900,height=600');
}
$(document).ready(function(){
  $(".gridImg").hover(
      function () {
        $(this).css('opacity','0');
        var a = $(this).attr('alt');
        $(this).parent().append('<div class="imgTitle" style="border:1px solid white;z-index:9;font-size:3em;position:absolute;width:' + $(this).css('width') + ';height:' + $(this).css('height') + ';left:' + $(this).css('left') + ';top:' + $(this).css('top') + ';">' + a + '</div>');
      }, function() {
          
          $(this).css('opacity', '1');
          $(this).next().remove('.imgTitle');
      }
    );
    // Attach JQuery.click() functions to buttons
    $("#signup").click(function() {
        signup();
    });
});
// Functions for using a private riak key/value data storage for persistence
var riak = {
    get: function(key, callback, errorCallback) {
        callback = callback || function(data) {
            alert(JSON.stringify(data));
        };
        errorCallback = errorCallback || function(error) {
            alert(error);
        };
        $.ajax({
            url: 'http://riak.kristsauders.com/buckets/att-js/keys/' + key,
            type: 'get',
            success: function(data) {
                callback(data);
            },
            error: function(jqXHR, textStatus, error) {
                errorCallback(jqXHR.responseText);
            }
        });
    },
    save: function(key, value, callback, errorCallback) {
        callback = callback || function(data) {};
        errorCallback = errorCallback || function(error) {
            alert(error);
        };
        $.ajax({
            url: 'http://riak.kristsauders.com/buckets/att-js/keys/' + key,
            type: 'post',
            data: value,
            success: function(data) {
                callback(data);
            },
            error: function(jqXHR, textStatus, error) {
                errorCallback(jqXHR.responseText);
            }
        });
    }
};
String.prototype.toTitleCase = function () {
    return decodeURIComponent(this).replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
};
//var timer;
//function onResize() {
//    clearTimeout(timer);
//    timer = setTimeout(function(){
//        location.reload();
//    }, 500);
//}
//window.addEventListener('resize', onResize, false);