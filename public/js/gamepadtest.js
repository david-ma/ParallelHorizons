/*
 * Gamepad API Test
 * Written in 2013 by Ted Mielczarek <ted@mielczarek.org>
 *
 * To the extent possible under law, the author(s) have dedicated all copyright and related and neighboring rights to this software to the public domain worldwide. This software is distributed without any warranty.
 *
 * You should have received a copy of the CC0 Public Domain Dedication along with this software. If not, see <http://creativecommons.org/publicdomain/zero/1.0/>.
 */
var haveEvents = 'GamepadEvent' in window;
var haveWebkitEvents = 'WebKitGamepadEvent' in window;
var controllers = {};
var rAF = requestAnimationFrame;

// window.mozRequestAnimationFrame ||
//     window.webkitRequestAnimationFrame ||
//     window.requestAnimationFrame;

function connecthandler(e) {
    addgamepad(e.gamepad);
}
function addgamepad(gamepad) {
    controllers[gamepad.index] = gamepad; var d = document.createElement("div");
    d.setAttribute("id", "controller" + gamepad.index);
    var t = document.createElement("h1");
    t.appendChild(document.createTextNode("gamepad: " + gamepad.id));
    d.appendChild(t);
    var b = document.createElement("div");
    b.className = "buttons";
    for (var i = 0; i < gamepad.buttons.length; i++) {
        var e = document.createElement("span");
        e.className = "button";
        //e.id = "b" + i;
        e.innerHTML = i;
        b.appendChild(e);
    }
    d.appendChild(b);
    var a = document.createElement("div");
    a.className = "axes";
    for (i = 0; i < gamepad.axes.length; i++) {
        e = document.createElement("meter");
        e.className = "axis";
        //e.id = "a" + i;
        e.setAttribute("min", "-1");
        e.setAttribute("max", "1");
        e.setAttribute("value", "0");
        e.innerHTML = i;
        a.appendChild(e);
    }
    d.appendChild(a);
    // document.getElementById("start").style.display = "none";
    document.getElementById("gamepadtest").appendChild(d);
    rAF(updateStatus);
}

function disconnecthandler(e) {
    removegamepad(e.gamepad);
}

function removegamepad(gamepad) {
    var d = document.getElementById("controller" + gamepad.index);
    document.body.removeChild(d);
    delete controllers[gamepad.index];
}


var lastCalledTime;
var fps;
var counter = 0;

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


var buttonActions = {
    1: function(action) {
        // Jumping action.
        if(action == "on") {
            if (gal.jump) {
                gal.moveVelocity.y += .2;
                gal.jump = false;
            };
        };
    },
    12: function(action) {
        // Go forward.
        // if(action == "on") gal.controls.moveForward( 1 );
        if(action == "on") gal.moveForward = true;
        if(action == "off") gal.moveForward = false;
    },
    13: function(action) {
        // Go back.
        if(action == "on") gal.moveBackward = true;
        if(action == "off") gal.moveBackward = false;
    },
    14: function(action) {
        // Go left.
        if(action == "on") gal.moveLeft = true;
        if(action == "off") gal.moveLeft = false;
    },
    15: function(action) {
        // Go Right.
        if(action == "on") gal.moveRight = true;
        if(action == "off") gal.moveRight = false;
    }
}

function updateStatus() {
    framerate();

    scangamepads();
    for (j in controllers) {
        var controller = controllers[j];
        var d = document.getElementById("controller" + j);
        var buttons = d.getElementsByClassName("button");
        for (var i = 0; i < controller.buttons.length; i++) {
            var b = buttons[i];
            var val = controller.buttons[i];
            var pressed = val == 1.0;
            if (typeof (val) == "object") {
                pressed = val.pressed;
                val = val.value;
            }
            var pct = Math.round(val * 100) + "%";
            b.style.backgroundSize = pct + " " + pct;
            if (pressed) {
                b.className = "button pressed";

                if(buttonActions[i]) buttonActions[i]("on");
            } else {
                b.className = "button";
                if(buttonActions[i]) buttonActions[i]("off");
            }
        }

        var axes = d.getElementsByClassName("axis");
        for (var i = 0; i < controller.axes.length; i++) {
            var a = axes[i];
            a.innerHTML = i + ": " + controller.axes[i].toFixed(4);
            a.setAttribute("value", controller.axes[i]);

            if(i == 0) {
                if (controller.axes[i] < -0.1) {
                    gal.analogLeft = controller.axes[i] * -1;
                } else if(controller.axes[i] > 0.1) {
                    gal.analogRight = controller.axes[i];
                } else {
                    gal.analogRight = 0;
                    gal.analogLeft = 0;
                }
            }
            if(i == 1) {
                if (controller.axes[i] < -0.1) {
                    gal.analogForward = controller.axes[i] * -1;
                } else if(controller.axes[i] > 0.1) {
                    gal.analogBackward = controller.axes[i];
                } else {
                    gal.analogForward = 0;
                    gal.analogBackward = 0;
                }
            }
            if(i == 2) {
                if (controller.axes[i] < -0.1) {
                    gal.analogY = controller.axes[i];
                } else if(controller.axes[i] > 0.1) {
                    gal.analogY = controller.axes[i];
                } else {
                    gal.analogY = 0;
                }
            }
            if(i == 3) {
                if (controller.axes[i] < -0.1) {
                    gal.analogX = controller.axes[i];
                } else if(controller.axes[i] > 0.1) {
                    gal.analogX = controller.axes[i];
                } else {
                    gal.analogX = 0;
                }
            }
        }
    }
    rAF(updateStatus);
}

function scangamepads() {
    var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
    for (var i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
            if (!(gamepads[i].index in controllers)) {
                addgamepad(gamepads[i]);
            } else {
                controllers[gamepads[i].index] = gamepads[i];
            }
        }
    }
}

if (haveEvents) {
    window.addEventListener("gamepadconnected", connecthandler);
    window.addEventListener("gamepaddisconnected", disconnecthandler);
} else if (haveWebkitEvents) {
    window.addEventListener("webkitgamepadconnected", connecthandler);
    window.addEventListener("webkitgamepaddisconnected", disconnecthandler);
} else {
    setInterval(scangamepads, 500);
}
