import * as THREE from '/gallery/js/three.module.js';
import { PointerLockControls } from '/gallery/js/PointerLockControls.js';

var lastCalledTime;
var fps;
var counter = 0;
var delta = 1;

console.log("running main");

function framerate() {
    if(!lastCalledTime) {
        lastCalledTime = performance.now();
        fps = 0;
        return;
     }
     delta = (performance.now() - lastCalledTime)/1000;
     lastCalledTime = performance.now();
     fps = 1/delta;
     if(counter++ % 30 == 0) $("#fps").text(Math.floor(fps));
}

if (!(Detector.webgl)) //if no support for WebGL
{
    alert("Your browser does not support WebGL!");
}
else {
    //////////////////////////////////////MAIN SCENE////////////////////////////////////////
    const PI_2 = Math.PI / 2;
    const speed = 38.0;

    var gal = {
		/*
		gal.scene;
		gal.camera;
		gal.renderer;
		gal.raycaster;
		gal.mouse;
		gal.raycastSetUp;
		gal.boot;
			gal.scene.fog;
			gal.controls;
			gal.canvas;
		gal.pointerControls;
			gal.changeCallback;
			gal.errorCallback;
			gal.moveCallback;
			gal.toggleFullScreen;
		gal.movement;
		gal.create;
		gal.render;
        */

        queue: [], // queue of functions to do
        axis: new THREE.Vector3(0, 1, 0),

        euler: new THREE.Euler(0, 0, 0, 'YXZ'),

        scene: new THREE.Scene(),
        camera: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
        renderer: new THREE.WebGLRenderer({ antialias: false }),
        raycaster: new THREE.Raycaster(),
        mouse: new THREE.Vector3(),
        raycastSetUp: function () {
            gal.mouse.x = 0; //(0.5) * 2 - 1;
            gal.mouse.y = 0; //(0.5) * 2 + 1;
            gal.mouse.z = 0.0001;
        },
        boot: function () {
            //renderer time delta
            gal.prevTime = performance.now();

            gal.initialRender = true;

            gal.scene.fog = new THREE.FogExp2(0x666666, 0.05);

            gal.renderer.setSize(window.innerWidth, window.innerHeight);
            gal.renderer.setClearColor(0xffffff, 1);
            document.body.appendChild(gal.renderer.domElement);

            gal.userBoxGeo = new THREE.BoxGeometry(2, 1, 2);
            gal.userBoxMat = new THREE.MeshBasicMaterial({ color: 0xeeee99, wireframe: true });
            gal.user = new THREE.Mesh(gal.userBoxGeo, gal.userBoxMat);

            //invisible since this will solely be used to determine the size
            //of the bounding box of our boxcollider for the user
            gal.user.visible = false;

            //making Bounding Box and HelperBox
            //boundingbox is used for collisions, Helper box just makes it easier to debug 
            gal.user.BBox = new THREE.Box3();

            //make our collision object a child of the camera
            gal.camera.add(gal.user);
            gal.camera.position.y = 1.75;

            gal.controls = new PointerLockControls(gal.camera, gal.renderer.domElement);
            gal.scene.add(gal.camera);

            gal.pastX = gal.camera.position.x;
            gal.pastZ = gal.camera.position.z;

            //https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector
            gal.canvas = document.querySelector('canvas');
            gal.canvas.className = "gallery";

            //Clicking on either of these will start the game
            gal.bgMenu = document.querySelector('#background_menu');
            gal.play = document.querySelector('#play_button');

            //enabling/disabling menu based on pointer controls
            gal.menu = document.getElementById("menu");

            //only when pointer is locked will translation controls be allowed: gal.controls.enabled
            gal.moveVelocity = new THREE.Vector3();
            gal.jump = true; // allow jump
            gal.moveForward = false;
            gal.moveBackward = false;
            gal.moveLeft = false;
            gal.moveRight = false;
            gal.analogForward = 0;
            gal.analogBackward = 0;
            gal.analogLeft = 0;
            gal.analogRight = 0;
            gal.analogX = 0;
            gal.analogY = 0;

            //Resize if window size change!
            window.addEventListener('resize', function () {
                gal.renderer.setSize(window.innerWidth, window.innerHeight);
                gal.camera.aspect = window.innerWidth / window.innerHeight;
                gal.camera.updateProjectionMatrix();
            });

        },

        pointerControls: function () {
            //////POINTER LOCK AND FULL SCREEN////////////
            //https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
            //gal.controls; 
            //if pointer lock supported in browser:
            if ('pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document) {
                //assign the API functions for pointer lock based on browser
                gal.canvas.requestPointerLock = gal.canvas.requestPointerLock || gal.canvas.mozRequestPointerLock || gal.canvas.webkitRequestPointerLock;
                //run this function to escape pointer Lock
                gal.canvas.exitPointerLock = gal.canvas.exitPointerLock || gal.canvas.mozExitPointerLock || gal.canvas.webkitExitPointerLock;


                //https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
                //https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
                document.addEventListener("keydown", function (e) {
                    if (e.keyCode === 102 || e.keyCode === 70) {//F/f for fullscreen hahaha 
                        gal.toggleFullscreen();
                        //refer to below event listener:
                        gal.canvas.requestPointerLock();
                    }
                });


				/*Order of executions:
				gal.canvas "click" -> "pointerlockchange" -> gl.changeCallback
				-> listen to mouse movement and locked

				ESC key -> "pointerlockchange" -> gl.changeCallback -> unlocked
				now listen to when the canvas is clicked on
				*/
                /* Following is unclickable since it's covered by bgMenu div
				gal.canvas.addEventListener("click", function() {
					gal.canvas.requestPointerLock();
				});
                */
                gal.bgMenu.addEventListener("click", function () {
                    gal.canvas.requestPointerLock();
                });
                gal.play.addEventListener("click", function () {
                    gal.canvas.requestPointerLock();
                });

                //pointer lock state change listener
                document.addEventListener('pointerlockchange', gal.changeCallback, false);
                document.addEventListener('mozpointerlockchange', gal.changeCallback, false);
                document.addEventListener('webkitpointerlockchange', gal.changeCallback, false);

                document.addEventListener('pointerlockerror', gal.errorCallback, false);
                document.addEventListener('mozpointerlockerror', gal.errorCallback, false);
                document.addEventListener('webkitpointerlockerror', gal.errorCallback, false);


            } else {
                // alert("Your browser does not support the Pointer Lock API");
                // gal.canvas.requestPointerLock();

                // activate mobile controls?
                // $("#mobile_controls").removeClass("hidden");

                // function mobile() {
                //     gal.menu.className += " hide";
                //     gal.bgMenu.className += " hide";
                // }

                // gal.play.addEventListener("click", mobile);
                // gal.bgMenu.addEventListener("click", mobile);
            }
        },

        mobileControls() {
            console.log("Activating mobile controls");
            var positions = [];
            [1, -1].forEach(z => {
                for(i = 0; i < 9; i++) {
                    positions.push({
                        z: z,
                        x: (-10) + (2.5 * i)
                    })
                }
            });

            $("#mob_left").on("click", () => {
                console.log("Click");
                moveToTarget(positions.shift())
            });

            function moveToTarget(target) {
                gal.render();
                alert(`moving to target (${target.z}, ${target.x})`)

                var targetPos = new THREE.Vector2( target.z, target.x )
                var currentPos = new THREE.Vector2( gal.camera.position.z, gal.camera.position.x )

                var angle = currentPos.sub(targetPos).angle()

                gal.queue = [];

                // look at target
                gal.queue.push(function(){
                    gal.camera.quaternionTarget = new THREE.Quaternion()
                        .setFromAxisAngle( gal.axis, angle )
                })

                // walk to target
                gal.queue.push(function() {
                    gal.targetPosition = { "x":target.x, "y":1.75, "z":target.z }
                })
                
                // look at art
                gal.queue.push(function() {
                    angle = new THREE.Vector2( -1 * target.z , 0 ).angle()
                    gal.camera.quaternionTarget = new THREE.Quaternion()
                        .setFromAxisAngle( gal.axis, angle )
                })

                gal.queue.shift()()
            }
        },

        changeCallback: function (event) {
            if (document.pointerLockElement === gal.canvas || document.mozPointerLockElement === gal.canvas || document.webkitPointerLockElement === gal.canvas) {
                //pointer is disabled by element
                gal.controls.enabled = true;
                //remove menu element from screen
                gal.menu.className += " hide";
                gal.bgMenu.className += " hide";
                //start mouse move listener
                document.addEventListener("mousemove", gal.moveCallback, false);

            } else {
                //pointer is no longer disabled
                gal.controls.enabled = false;
                // remove hidden property from menu
                gal.menu.className = gal.menu.className.replace(/(?:^|\s)hide(?!\S)/g, '');
                gal.bgMenu.className = gal.bgMenu.className.replace(/(?:^|\s)hide(?!\S)/g, '');
                document.removeEventListener("mousemove", gal.moveCallback, false);
            }
        },

        errorCallback: function (event) {
            console.error("Pointer Lock Failed");
        },

        moveCallback: function (event) {
            //now that pointer disabled, we get the movement in x and y pos of the mouse
            var movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            var movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
        },

        toggleFullscreen: function () {
            if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {  // current working methods
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen();
                } else if (document.documentElement.msRequestFullscreen) {
                    document.documentElement.msRequestFullscreen();
                } else if (document.documentElement.mozRequestFullScreen) {
                    document.documentElement.mozRequestFullScreen();
                } else if (document.documentElement.webkitRequestFullscreen) {
                    document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
            }
        },

        movement: function () {
            document.addEventListener("keydown", function (e) {
                if (e.keyCode === 87 || e.keyCode === 38) { //w or UP
                    gal.moveForward = true;
                }
                else if (e.keyCode === 65 || e.keyCode === 37) { //A or LEFT
                    gal.moveLeft = true;
                }
                else if (e.keyCode === 83 || e.keyCode === 40) { //S or DOWN 
                    gal.moveBackward = true;
                }
                else if (e.keyCode === 68 || e.keyCode === 39) { //D or RIGHT
                    gal.moveRight = true;
                }
                else if (e.keyCode === 32) { //Spacebar
                    if (gal.jump) {
                        gal.moveVelocity.y += .2;
                        gal.jump = false;
                    }
                }
            });

            document.addEventListener("keyup", function (e) {
                if (e.keyCode === 87 || e.keyCode === 38) { //w or UP
                    gal.moveForward = false;
                }
                else if (e.keyCode === 65 || e.keyCode === 37) { //A or LEFT
                    gal.moveLeft = false;
                }
                else if (e.keyCode === 83 || e.keyCode === 40) { //S or DOWN 
                    gal.moveBackward = false;
                }
                else if (e.keyCode === 68 || e.keyCode === 39) { //D or RIGHT
                    gal.moveRight = false;
                }
                else if (e.keyCode === 81) {
// Press Q for testing a new feature.
// TODO: Remove after feature complete!
                    console.log("Try to move to target position?");
                    gal.targetPosition = {"x":10.288147066797656,"y":1.75,"z":1.043671234909461}


                    // gal.camera.quaternion = {"_x":0.00000386955804149291,"_y":-0.9998194846923328,"_z":0.01899885645990376,"_w":0.00020363644178840833}
                    // gal.euler = {"_x":0,"_y":Math.PI,"_z":-PI_2,"_order":"YXZ"}
                    // gal.camera.quaternion.setFromEuler(gal.euler);
                    // gal.camera.quaternionTarget = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI,0,"XYZ"));

                    // console.log(gal.camera.getWorldDirection()

                    var targetPoint = new THREE.Vector3(1, 1.75, 10)

                    console.log("looking at... ", targetPoint)

                    var dir = new THREE.Vector3(); // create once an reuse it
                    dir = dir.subVectors( gal.camera.position, targetPoint ).normalize();

                    console.log(dir);

                    var axis = new THREE.Vector3(0, 1, 0)

                    gal.camera.quaternionTarget = new THREE.Quaternion()
                        .setFromAxisAngle(
                            axis, (5 * Math.PI/4)
                        )

                    // console.log(gal.camera.quaternionTarget);

                } else if (e.keyCode === 69) {
                    console.log(`x: ${gal.camera.position.x}, z: ${gal.camera.position.z}`)
                    // console.log("Activating mobile controls");
                    var positions = [];
                    [1, -1].forEach(z => {
                        for(i = 0; i < 9; i++) {
                            positions.push({
                                z: z,
                                x: (-10) + (2.5 * i)
                            })
                        }
                    });

                    setInterval(
                        function() {
                            moveToTarget(positions[Math.floor(Math.random() * positions.length)]);
                        }, 6000
                    );


                    function moveToTarget(target) {
                        console.log(`moving to target (${target.z}, ${target.x})`)
        
                        var targetPos = new THREE.Vector2( target.z, target.x )
                        var currentPos = new THREE.Vector2( gal.camera.position.z, gal.camera.position.x )
        
                        var angle = currentPos.sub(targetPos).angle()
        
                        gal.queue = [];
        
                        // look at target
                        gal.queue.push(function(){
                            gal.camera.quaternionTarget = new THREE.Quaternion()
                                .setFromAxisAngle( gal.axis, angle )
                        })
        
                        // walk to target
                        gal.queue.push(function() {
                            gal.targetPosition = { "x":target.x, "y":1.75, "z":target.z }
                        })
                        
                        // look at art
                        gal.queue.push(function() {
                            angle = new THREE.Vector2( -1 * target.z , 0 ).angle()
                            gal.camera.quaternionTarget = new THREE.Quaternion()
                                .setFromAxisAngle( gal.axis, angle )
                        })
        
                        gal.queue.shift()()
                    }
                } else if (e.keyCode === 82) {

                    var target = {
                        x: 10,
                        z: 1
                    }
                    var targetPos = new THREE.Vector2( target.z, target.x )
                    var currentPos = new THREE.Vector2( gal.camera.position.z, gal.camera.position.x )

                    var angle = currentPos.sub(targetPos).angle()

                    gal.queue = [];

                    gal.queue.push(function(){
                        gal.camera.quaternionTarget = new THREE.Quaternion()
                            .setFromAxisAngle( gal.axis, angle )
                    })

                    gal.queue.push(function() {
                        gal.targetPosition = { "x":10, "y":1.75, "z":1 }
                    })
                    
                    gal.queue.push(function() {
                        angle = new THREE.Vector2( -1 , 0 ).angle()
                        gal.camera.quaternionTarget = new THREE.Quaternion()
                            .setFromAxisAngle( gal.axis, angle )
                    })

                    gal.queue.shift()()

                }
            });
        },

        create: function () {

            //let there be light!
            gal.worldLight = new THREE.AmbientLight(0xffffff);
            gal.scene.add(gal.worldLight);

            //set the floor up
            gal.floorText = new THREE.TextureLoader().load("/gallery/img/Textures/Floor.jpg");
            gal.floorText.wrapS = THREE.RepeatWrapping;
            gal.floorText.wrapT = THREE.RepeatWrapping;
            gal.floorText.repeat.set(24, 24);

            //Phong is for shiny surfaces
            gal.floorMaterial = new THREE.MeshPhongMaterial({ map: gal.floorText });
            gal.floor = new THREE.Mesh(new THREE.PlaneGeometry(45, 45), gal.floorMaterial);

            gal.floor.rotation.x = Math.PI / 2;
            gal.floor.rotation.y = Math.PI;
            gal.scene.add(gal.floor);

            //Create the walls////
            gal.wallGroup = new THREE.Group();
            gal.scene.add(gal.wallGroup);

            gal.wall1 = new THREE.Mesh(new THREE.BoxGeometry(40, 6, 0.001), new THREE.MeshLambertMaterial({ color: 0xffffff }));
            gal.wall2 = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.001), new THREE.MeshLambertMaterial({ color: 0xffffff }));
            gal.wall3 = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.001), new THREE.MeshLambertMaterial({ color: 0xffffff }));
            gal.wall4 = new THREE.Mesh(new THREE.BoxGeometry(40, 6, 0.001), new THREE.MeshLambertMaterial({ color: 0xffffff }));

            gal.wallGroup.add(gal.wall1, gal.wall2, gal.wall3, gal.wall4);
            gal.wallGroup.position.y = 3;

            gal.wall1.position.z = -3;
            gal.wall2.position.x = -20;
            gal.wall2.rotation.y = Math.PI / 2;
            gal.wall3.position.x = 20;
            gal.wall3.rotation.y = -Math.PI / 2;
            gal.wall4.position.z = 3;
            gal.wall4.rotation.y = Math.PI;

            for (var i = 0; i < gal.wallGroup.children.length; i++) {
                gal.wallGroup.children[i].BBox = new THREE.Box3();
                gal.wallGroup.children[i].BBox.setFromObject(gal.wallGroup.children[i]);
            }

            //Ceiling//
            //gal.ceilMaterial = new THREE.MeshLambertMaterial({color: 0x8DB8A7});
            gal.ceilMaterial = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
            gal.ceil = new THREE.Mesh(new THREE.PlaneGeometry(40, 6), gal.ceilMaterial);
            gal.ceil.position.y = 6;
            gal.ceil.rotation.x = Math.PI / 2;

            gal.scene.add(gal.ceil);

            ///////Add 3D imported Objects ////
            /*
            gal.objects = [];
            //OBJ to JSON converter Python Tool
            //three.js/utils/converters/obj/convert_obj_three.py
            //python convert_obj_tree.py -i teapot.obj -o teapot.js
            gal.loader = new THREE.JSONLoader();
            gal.loader.load(".\\objects\\icosphere.json", function(geometry, materials) {
                var materialIco = new THREE.MeshNormalMaterial();
                gal.ico = new THREE.Mesh(geometry, materialIco);
                gal.ico.position.y = 2;
                gal.ico.position.x = 18;
                gal.ico.scale.set(0.25, 0.25, 0.25);
                gal.scene.add(gal.ico);
                gal.objects.push(gal.ico);
            });
            */
            /* Process for importing more objects is pretty straight forward
            gal.loader.load(".\\objects\\icosphere.json", function(geometry, materials) {
                var materialIco = new THREE.MeshNormalMaterial();
                gal.ico2 = new THREE.Mesh(geometry, materialIco);
                gal.ico2.position.x = 1;
                gal.scene.add(gal.ico2);
            });
            */

            ///////Add Artworks~///////
            gal.artGroup = new THREE.Group();

            gal.num_of_paintings = 30;
            gal.paintings = [];
            for (var i = 0; i < gal.num_of_paintings; i++) {
                (function (index) {
                    //https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/Image
                    var artwork = new Image();
                    var ratiow = 0;
                    var ratioh = 0;

                    var source = '/gallery/img/Artworks/' + (index).toString() + '.jpg';
                    artwork.src = source;

                    var texture = new THREE.TextureLoader().load(artwork.src);

                    texture.minFilter = THREE.LinearFilter;
                    var img = new THREE.MeshBasicMaterial({ map: texture });

                    artwork.onload = function () {
                        ratiow = artwork.width / 1024;
                        ratioh = artwork.height / 1024;
                        // plane for artwork
                        var plane = new THREE.Mesh(new THREE.PlaneGeometry(ratiow, ratioh), img); //width, height
                        plane.overdraw = true;
                        //-1 because index is 0 - n-1 but num of paintings is n 
                        if (index <= Math.floor(gal.num_of_paintings / 2) - 1) //bottom half
                        {
                            //plane.rotation.z = Math.PI/2;
                            plane.position.set(2.5 * index - 17.5, 2, -2.96); //y and z kept constant
                        }
                        else {
                            //plane.rotation.z = Math.PI/2;
                            plane.position.set(2.5 * index - 55, 2, 2.96);
                            //plane.position.set(65*i - 75*Math.floor(gal.num_of_paintings/2) - 15*Math.floor(num_of_paintings/2), 48, 90);
                            plane.rotation.y = Math.PI;
                        }

                        //https://aerotwist.com/tutorials/create-your-own-environment-maps/
                        gal.scene.add(plane);
                        gal.paintings.push(plane);
                    };

                    img.map.needsUpdate = true; //ADDED
                }(i))
            }
        },
        render: function () {
            framerate();
            requestAnimationFrame(gal.render);

            if( gal.analogX || gal.analogY) {
                console.log("Analog sticks being used?");

                gal.euler.setFromQuaternion(gal.camera.quaternion);
                gal.euler.y -= gal.analogY * 0.04;
                gal.euler.x -= gal.analogX * 0.04;
                gal.euler.x = Math.max(- PI_2, Math.min(PI_2, gal.euler.x));
                gal.camera.quaternion.setFromEuler(gal.euler);
            }

            ////Movement Controls /////
            if (gal.screensaver || gal.controls.enabled === true) {
                gal.initialRender = false;
                var currentTime = performance.now(); //returns time in milliseconds
                //accurate to the thousandth of a millisecond
                //want to get the most accurate and smallest change in time
                var delta = (currentTime - gal.prevTime) / 1000;

                //there's a constant deceleration that needs to be applied
                //only when the object is currently in motion
                gal.moveVelocity.x -= gal.moveVelocity.x * 10.0 * delta;
                //for now
                gal.moveVelocity.z -= gal.moveVelocity.z * 10.0 * delta;

                //need to apply velocity when keys are being pressed
                if (gal.moveForward) {
                    gal.moveVelocity.z -= speed * delta;
                }
                if (gal.moveBackward) {
                    gal.moveVelocity.z += speed * delta;
                }
                if (gal.moveLeft) {
                    gal.moveVelocity.x -= speed * delta;
                }
                if (gal.moveRight) {
                    gal.moveVelocity.x += speed * delta;
                }

                if (gal.analogForward) {
                    gal.moveVelocity.z -= speed * gal.analogForward * delta;
                }
                if (gal.analogBackward) {
                    gal.moveVelocity.z += speed * gal.analogBackward * delta;
                }
                if (gal.analogLeft) {
                    gal.moveVelocity.x -= speed * gal.analogLeft * delta;
                }
                if (gal.analogRight) {
                    gal.moveVelocity.x += speed * gal.analogRight * delta;
                }

                // gal.camera.translateX(gal.moveVelocity.x * delta);
                // gal.camera.translateZ(gal.moveVelocity.z * delta);

                gal.controls.moveForward(gal.moveVelocity.z * delta * -1);
                gal.controls.moveRight(gal.moveVelocity.x * delta);



                // To turn the camera...
                // gal.euler.setFromQuaternion(gal.camera.quaternion);

                // console.log(JSON.stringify(gal.euler));
                // console.log(gal.euler);


                // gal.euler.y -= gal.analogY * 0.04;
                // gal.euler.x -= gal.analogX * 0.04;
    
                // gal.euler.x = Math.max(- PI_2, Math.min(PI_2, gal.euler.x));
    
                // gal.camera.quaternion.setFromEuler(gal.euler);



// Move to target position
                if (gal.targetPosition) {
                    var deltaX = gal.camera.position.x - gal.targetPosition.x;
                    gal.camera.position.x -= (speed * Math.cbrt(deltaX) * delta) / 12;

                    var deltaZ = gal.camera.position.z - gal.targetPosition.z;
                    gal.camera.position.z -= (speed * Math.cbrt(deltaZ) * delta) / 12;

                    if(deltaX * deltaX < 0.001 && deltaZ * deltaZ < 0.001) {
                        console.log("Target position reached");
                        delete gal.targetPosition;
                        if(gal.queue.length != 0) gal.queue.shift()();
                    }
                }

// Turn to face target quarternion
                if(gal.camera.quaternionTarget) {
                    var angle = gal.camera.quaternion.angleTo(gal.camera.quaternionTarget);
                    // console.log(`angle is ${angle}`);


                    gal.camera.quaternion.rotateTowards(gal.camera.quaternionTarget, 0.03);
                    // if(angle < 0.7) {
                    if (gal.camera.quaternion.equals(gal.camera.quaternionTarget)) {
                        console.log("target look reached");
                        delete gal.camera.quaternionTarget;
                        if(gal.queue.length != 0) gal.queue.shift()();
                    }
                }


                if (gal.camera.position.z < -2) {
                    gal.camera.position.z = -2;
                }
                if (gal.camera.position.z > 2) {
                    gal.camera.position.z = 2;
                }
                if (gal.camera.position.x < -18) {
                    gal.camera.position.x = -18;
                }
                if (gal.camera.position.x > 18) {
                    gal.camera.position.x = 18;
                }




// Apply gravity based on the world. Not the camera!!!!
// Gravity
gal.moveVelocity.y -= .6 * delta;
gal.camera.position.y += gal.moveVelocity.y;



                // floor?
                if (gal.camera.position.y < 1.75) {
                    gal.jump = true;
                    gal.moveVelocity.y = 0;
                    gal.camera.position.y = 1.75;
                }

                // roof?
                if (gal.camera.position.y > 5) {
                    gal.moveVelocity.y = 0;
                    gal.camera.position.y = 5;
                }





                //rayCaster/////
                gal.raycaster.setFromCamera(gal.mouse.clone(), gal.camera);
                //calculate objects interesting ray
                gal.intersects = gal.raycaster.intersectObjects(gal.paintings);
                if (gal.intersects.length !== 0) {
                    // gal.intersects[0].object.material.color.set(0xaaeeee);
                    //console.log(intersects[0].distance);
                    // console.log(gal.intersects[0].point);
                }

                for (var i = 0; i < gal.wallGroup.children.length; i++) {

                    if (gal.user.BBox.intersectsBox(gal.wallGroup.children[i].BBox)) {

                        //reffer to  forced positioning from above
                        //if gets to a certain value, force value to that value?
                        /*
                        if(gal.camera.position.x > gal.pastX) { //collision on right side
                            gal.camera.position.x = gal.pastX;
                        }
                        else if(gal.camera.position.x < gal.pastX) { //collision on left side
                            gal.camera.position.x = gal.pastX;
                        }
                        if(gal.camera.position.z > gal.pastZ) { //collision from front
                            gal.camera.position.z = gal.pastZ;
                        }
                        else if(gal.camera.position.z < gal.pastZ) {
                            gal.camera.position.z = gal.pastZ;
                        }
                        */
                        /*
						gal.camera.position.x -= gal.pastX * delta * .9;
						gal.camera.position.z -= gal.pastZ * delta * .9;

						gal.moveVelocity.x = 0;
						gal.moveVelocity.z = 0;
                        */
                        gal.user.BBox.setFromObject(gal.user);
                    }
                    else {
                        gal.wallGroup.children[i].material.color.set(0xffffff);
                    }
                }
                gal.pastX = gal.camera.position.x;
                gal.pastZ = gal.camera.position.z;

                gal.user.BBox.setFromObject(gal.user);

                gal.prevTime = currentTime;

                gal.renderer.render(gal.scene, gal.camera);
            }
            else {
                //reset delta time, so when unpausing, time elapsed during pause
                //doesn't affect any variables dependent on time.
                gal.prevTime = performance.now();
            }

            if (gal.initialRender === true) {
                for (var i = 0; i < gal.wallGroup.children.length; i++) {
                    gal.wallGroup.children[i].BBox.setFromObject(gal.wallGroup.children[i]);
                }
                gal.renderer.render(gal.scene, gal.camera);
            }
        }
    };

    gal.raycastSetUp();
    gal.boot();
    gal.pointerControls();
    // gal.mobileControls();
    gal.movement();
    gal.create();
    gal.render();
}


export { gal };
