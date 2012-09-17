
function loginSuccess() {
    setTimeout(function(){window.location.reload(true);}, 1000);
}
    
function login() {
    var data = new Object();
    data.user = prompt("Enter username","");
    data.password = prompt("Enter password","");
    $.ajax({
       type: 'POST',
       url: '/users/list/login',
       data: data,
       success: loginSuccess(),
       dataType: 'json'
    });
}

function logoutSuccess() {
        setTimeout(function(){window.location.reload(true);}, 1000);
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
	if(x[i].name.split("jpgdivNI")[1]=="mG" || x[i].name.split("pngdivNI")[1]=="mG") {
	var element = document.createElement("input");
	element.setAttribute("type","button");
	element.setAttribute("value","x");
	element.setAttribute("onclick","javascript:deleteImage(this)");
	element.onclick = function() {deleteImage(this);};
	element.style.position = 'absolute';
	element.style.left = '0px';
	element.style.top = '0px';
	x[i].parentNode.appendChild(element);
	}
}
	document.getElementById("adminDeleteButton").onclick = hideDelete;
	document.getElementById("adminDeleteButton").value = "Done deleting";
	
}

function hideDelete() {
	x = document.getElementsByTagName("img");
	for (i=0;i<x.length;i++)
	{
		if(x[i].name.split("jpgdivNI")[1]=="mG" || x[i].name.split("pngdivNI")[1]=="mG") {
			x[i].parentNode.removeChild(x[i].parentNode.lastChild);
		}
    }
	document.getElementById("adminDeleteButton").onclick = showDelete;
	document.getElementById("adminDeleteButton").value = "Delete image";
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
        document.getElementById("fullScreenImage").src = el.src;
        var ih = document.getElementById(el.id).firstChild.height;
        var iw = document.getElementById(el.id).firstChild.width;
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
       var hiResImg = new Image();
       hiResImg.src = el.src.substring(0,el.src.lastIndexOf('-')) + '-large' + el.src.substring(el.src.lastIndexOf('.'));
       if(hiResImg.complete) {
           if((document.getElementById("fullScreenImage").style.visibility=='visible') && (document.getElementById("fullScreenImage").src==el.src)) {
                document.getElementById("fullScreenImage").src = hiResImg.src;
           }
       }
       hiResImg.onload = function() {
           if((document.getElementById("fullScreenImage").style.visibility=='visible') && (document.getElementById("fullScreenImage").src==el.src)) {
               document.getElementById("fullScreenImage").src = hiResImg.src;
           }
       }
        ddpp = dd;
        dd.obj=null;
        dd.evt=function(d_e) {};
     }
}

function closeFullscreen() {
    dd=ddpp;
    dd.evt = function(d_e)
    {
        this.but = (this.e = d_e || window.event).which || this.e.button || 0;
        this.button = (this.e.type == 'mousedown')? this.but
    		: (dd.e && dd.e.button)? dd.e.button
    		: 0;
    	this.src = this.e.target || this.e.srcElement || null;
    	this.src.tag = ("" + (this.src.tagName || this.src)).toLowerCase();
    	this.x = dd.Int(this.e.pageX || this.e.clientX || 0);
    	this.y = dd.Int(this.e.pageY || this.e.clientY || 0);
    	if(dd.ie)
    	{
    		this.x += dd.getScrollX() - (dd.ie && !dd.iemac)*1;
    		this.y += dd.getScrollY() - (dd.ie && !dd.iemac)*1;
    	}
    	//this.modifKey = this.e.modifiers? this.e.modifiers&Event.SHIFT_MASK : (this.e.shiftKey || false);
    	if((this.but==3) || (this.but==2)){
    		this.modifKey = true;
    	} else {
    		this.modifKey = false;
    	}
    };
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
    x = document.getElementsByTagName("img");
	for (i=0;i<x.length;i++)
	{
		if(x[i].name.split("jpgdivNI")[1]=="mG" || x[i].name.split("pngdivNI")[1]=="mG") {
			x[i].parentNode.removeChild(x[i].parentNode.lastChild);
		}
    }
	document.getElementById("updateLinkButton").onclick = showLinkUpdate;
	document.getElementById("updateLinkButton").value = "Update Image Link";
}

function showLinkUpdate() {
    x = document.getElementsByTagName("img");
	for (i=0;i<x.length;i++)
	{
    	if(x[i].name.split("jpgdivNI")[1]=="mG" || x[i].name.split("pngdivNI")[1]=="mG") {
    	var element = document.createElement("input");
    	element.setAttribute("type","button");
    	element.setAttribute("value","This");
    	element.setAttribute("onclick","javascript:updateLink(this)");
    	element.onclick = function() {updateLink(this);};
    	element.style.position = 'absolute';
    	element.style.left = '0px';
    	element.style.top = '0px';
    	x[i].parentNode.appendChild(element);
    	}
    }
	document.getElementById("updateLinkButton").onclick = hideLinkUpdate;
	document.getElementById("updateLinkButton").value = "Cancel";
	
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
function signup() {
    var data = new Object();
    data.user = prompt("Enter username","");
    data.password = prompt("Enter password","");
    function signupSuccess() {
    setTimeout(function(){
		window.location = '/' + data.user + '/galleries/list';
	}, 1000);
    }
    $.ajax({
       type: 'POST',
       url: '/users/list/new',
       data: data,
       success: signupSuccess(),
       dataType: 'json'
    });
}
function deleteAccount() {
    var data = new Object();
    data.user = prompt("Enter username","");
    data.password = prompt("Enter password","");
    function deleteUser() {
    setTimeout(function(){
		window.location = '/admin';
	}, 1000);
    }
    $.get(
       '/users/list/account/delete/' + data.user,
       function(data) {
	deleteUser();
    });
}
function newGallery() {
    var data = new Object();
    data.user = prompt("Enter username","");
    data.gallery = prompt("Enter gallery name","");
    function newGallerySuccess() {
    setTimeout(function(){
		window.location = '/' + data.user + '/' + data.gallery;
	}, 1000);
    }
    $.ajax({
       type: 'POST',
       url: '/' + data.user + '/galleries/new',
       data: data,
       success: newGallerySuccess(data),
       dataType: 'json'
    });
}
function deleteGallery() {
    var data = new Object();
    data.user = prompt("Enter username","");
    data.gallery = prompt("Enter gallery","");
    data.password = prompt("Enter password","");
    function deleteGallery() {
    setTimeout(function(){
		window.location = '/' + data.user + '/galleries/list';
	}, 1000);
    }
    $.get(
       '/' + data.user + '/' + data.gallery + '/delete',
       function(data) {
	deleteGallery();
    });
}
function drawImage() {
    window.open(document.URL.split('#')[0].split('?')[0] + '/draw','_blank','location=0,width=900,height=600');
}