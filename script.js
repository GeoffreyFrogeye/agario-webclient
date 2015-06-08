function AnimatedValue(value) {
    this.write(value);
}

AnimatedValue.prototype = {
    get: function () {
        if (this.timeout) {
            var now = performance.now(),
                end = this.frTime + this.timeout;
            if (now >= end) {
                this.timeout = 0;
                return this.toVal;
            } else {
                if (this.following) {
                    this.toVal = this.following();
                }
                return this.toVal - (this.toVal - this.frVal) * (end - now) / this.timeout;
            }
        } else {
            return this.toVal;
        }
    },
    set: function (value, timeout) {
        if (value != this.toVal) {
            this.frVal = this.get();
            this.toVal = value;
            this.timeout = timeout;
            this.following = undefined;
            this.frTime = performance.now();
        }
    },
    follow: function (following, timeout) {
        this.frVal = this.get();
        this.following = following;
        this.timeout = timeout;
        this.frTime = performance.now();
    },
    write: function (value) {
        this.frVal = value;
        this.toVal = value;
        this.timeout = 0;
        this.frTime = performance.now(); // so end == now
    }
};

PIXI.Container.prototype.bringToFront = function () {
    if (this.parent) {
        var parent = this.parent;
        parent.removeChild(this);
        parent.addChild(this);
    }
};

function BallView(main, ball) {
    this.main = main;
    this.ball = ball;
    this.container = new PIXI.Container();
    this.graphic = new PIXI.Graphics();
    this.container.addChild(this.graphic);

    this.x = new AnimatedValue(0);
    this.y = new AnimatedValue(0);
    this.s = new AnimatedValue(0);

    var _this = this;
    this.appear();
    this.ball.on('appear', function () {
        _this.appear();
    });
    this.ball.on('destroy', function (reason) {
        if (reason.reason == 'eaten') {
            var eater = _this.main.balls[reason.by];
            if (eater && eater.ball.id != _this.ball.id) {
                _this.x.follow(function () {
                    return eater.x.get();
                }, 100);
                _this.y.follow(function () {
                    return eater.y.get();
                }, 100);
                setTimeout(function () {
                    _this.disappear();
                }, 50);
            } else {
                _this.disappear();
            }
        } else {
            _this.disappear();
        }
    });
    this.ball.on('disappear', function () {
        _this.disappear();
    });
    this.ball.on('move', function (old_x, old_y, new_x, new_y) {
        _this.x.set(new_x, 100);
        _this.y.set(new_y, 100);
    });
    this.ball.on('resize', function (old_size, new_size) {
        _this.s.set(new_size, 100);
        _this.main.zSort(new_size);
    });
}

BallView.prototype = {
    appear: function () {
        this.x.write(this.ball.x);
        this.y.write(this.ball.y);
        this.s.set(this.ball.size, 100);
        this.shape();
        this.setName();
        this.setMass();
        this.main.zSort(this.ball.size);
        this.main.stage.addChild(this.container);
    },
    disappear: function () {
        this.s.set(0, 100);
        var _this = this;
        setTimeout(function () {
            _this.main.stage.removeChild(_this.container);
        }, 100);
    },
    shape: function () {
        this.graphic.clear();
        this.graphic.beginFill(this.ball.virus ? 0x005500 : this.ball.color.replace('#', '0x'), 1);
        this.graphic.drawCircle(0, 0, 1);
        this.graphic.endFill();
    },
    setName: function () {
        if (this.ball.name) {
            if (!this.name) {
                this.name = new PIXI.Text(this.ball.name, {
                    font: 'bold 20pt Arial',
                    fill: 0xFFFFFF,
                    stroke: 0x000000,
                    strokeThickness: 5
                });
                var _this = this;
                this.ball.on('rename', function () {
                    _this.updateName();
                });
            }
            this.updateName();
            this.container.addChild(this.name);
        } else {
            if (this.name) {
                this.container.removeChild(this.text);
                this.ball.removeAllListener('rename');
                delete this.text;
            }
        }
    },
    updateName: function () {
        this.name.resolution = 10;
        this.name.scale.x = this.name.scale.y *= 2 * 0.9 / this.name.width;
        this.name.position.x = -this.name.width / 2;
        this.name.position.y = -this.name.height / 2;
    },
    setMass: function () {
        if (this.ball.mine) {
            if (!this.mass) {
                this.mass = new PIXI.Text(this.ball.size, {
                    font: 'bold 20pt Arial',
                    fill: 0xFFFFFF,
                    stroke: 0x000000,
                    strokeThickness: 5
                });
                var _this = this;
                this.ball.on('resize', function () {
                    _this.updateMass();
                });
            }
            this.updateMass();
            this.container.addChild(this.mass);
        } else {
            if (this.mass) {
                this.container.removeChild(this.mass);
                this.ball.removeAllListeners('rename');
                delete this.mass;
            }
        }
    },
    updateMass: function () {
        this.mass.text = this.ball.size;
        this.mass.resolution = 10;
        this.mass.scale.x = this.mass.scale.y *= 0.5 / this.mass.width;
        this.mass.position.x = -this.mass.width / 2;
        this.mass.position.y = this.name ? this.name.height / 2 : 0;
    },
    render: function () {
        this.container.position.x = this.x.get();
        this.container.position.y = this.y.get();
        this.container.scale.x = this.container.scale.y = this.s.get();
    }
};


function Viewer(client, container) {
    this.client = client;
    this.container = container;

    this.balls = {};

    this.addRenderer();
    this.addStats();
    var _this = this;
    client.once('mapSizeLoad', function (min_x, min_y, max_x, max_y) {
        _this.gameWidth = max_x;
        _this.gameHeight = max_y;
        _this.initStage();
        _this.addListners();
        _this.addBorders();
        _this.animate();
        _this.homeview = true;
        client.once('myNewBall', function() {
            _this.homeview = false;
        });
        _this.emit('launched');
    });
    window.addEventListener('resize', function () {
        _this.updateSize();
    });
}

Viewer.prototype = {
    getSize: function () {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
    },
    addRenderer: function () {
        this.getSize();
        this.renderer = PIXI.autoDetectRenderer(this.width, this.height, {
            antialias: true
        });
        this.container.appendChild(this.renderer.view);
    },
    updateSize: function () {
        this.getSize();
        this.renderer.resize(this.width, this.height);
    },
    defaultScale: function () {
        return Math.max(this.width / 1920, this.height / 1080)
    },
    initStage: function () {
        this.stage = new PIXI.Container();
        this.cam = {
            x: new AnimatedValue(this.gameWidth / 2),
            y: new AnimatedValue(this.gameHeight / 2),
            s: new AnimatedValue(this.defaultScale())
        };
        this.d = {};
        this.dg = new PIXI.Graphics();
        this.stage.addChild(this.dg);
    },
    addListners: function () {
        var _this = this;
        this.client.on('ballAppear', function (id) {
            if (!_this.balls[id]) {
                _this.balls[id] = new BallView(_this, this.balls[id]);
            } else {}
        });
        this.client.on('ballDestroy', function (id) {
            delete this.balls[id];
        });
    },
    addBorders: function () {
        this.borders = new PIXI.Graphics();
        this.borders.lineStyle(5, 0xFF3300, 1);
        this.borders.drawRect(0, 0, this.gameWidth, this.gameHeight);
        this.stage.addChild(this.borders);
    },
    addStats: function () {
        this.stats = new Stats();
        this.stats.setMode(1);
        this.stats.domElement.style.position = 'absolute';
        this.stats.domElement.style.left = '0px';
        this.stats.domElement.style.top = '0px';
        document.body.appendChild(this.stats.domElement);
    },
    zSort: function (at) {
        if (!at) {
            at = 0;
        }
        var keys = Object.keys(this.balls);
        var _this = this;
        keys.sort(function (a, b) {
            return _this.balls[a].ball.size - _this.balls[b].ball.size;
        });
        for (var key_offset in keys) {
            var ball = this.balls[keys[key_offset]];
            if (ball.ball.size >= at) {
                ball.container.bringToFront();
            }
        }
    },
    posCamera: function () {
        var x = y = p = 0;
        for (var ball_id in this.client.my_balls) {
            var ball = this.client.balls[this.client.my_balls[ball_id]];
            if (!ball.visible) continue;
            x += ball.x * ball.size;
            y += ball.y * ball.size;
            p += ball.size;
        }
        if (p > 0) { // if we have visible ball(s)
            this.cam.x.set(x / p, 100);
            this.cam.y.set(y / p, 100);
            this.cam.s.set(Math.pow(Math.min(64 / p, 1), 0.4) * this.defaultScale(), 500);
        } else if (this.homeview) {
            this.cam.s.write(this.defaultScale());
        } // else: don't move the camera
    },
    render: function () {
        for (var ball_id in this.client.balls) {
            var ball = this.balls[ball_id];
            if (ball) {
                ball.render();
            }
        }
    },
    animate: function () {
        this.stats.begin();
        this.render();
        this.posCamera();
        this.stage.scale.x = this.stage.scale.y = this.cam.s.get();
        this.stage.position.x = -this.cam.x.get() * this.stage.scale.x + this.width / 2;
        this.stage.position.y = -this.cam.y.get() * this.stage.scale.y + this.height / 2;
        this.renderer.render(this.stage);
        this.stats.end();
        this.emit('animate');
        var _this = this;
        requestAnimationFrame(function () {
            _this.animate();
        });
    }
};

// Inherit from EventEmitter
for (var key in EventEmitter.prototype) {
    Viewer.prototype[key] = EventEmitter.prototype[key];
}

function Pointer(viewer) {
    this.viewer = viewer;
    this.client = this.viewer.client;
    this.dest = { // Destination, relative to camera center
        x: 0,
        y: 0
    };
    var _this = this;
    this.viewer.once('launched', function () {
        _this.viewer.stage.interactive = true;
        _this.viewer.stage.on('mousemove', function (e) {
            _this.pointermove(e);
        });
        _this.viewer.stage.on('touchmove', function (e) {
            _this.pointermove(e);
        });
        _this.viewer.on('animate', function (e) {
            _this.move();
        });
    });
    window.addEventListener('keydown', function (e) {
        if (e.keyCode == 87) {
            _this.client.eject();
        } else if (e.keyCode == 32) {
            _this.client.split();
        }
    });
}

Pointer.prototype = {
    move: function () {
        this.client.moveTo(this.viewer.cam.x.get() + this.dest.x, this.viewer.cam.y.get() + this.dest.y);
    },
    pointermove: function (e) {
        var gamePos = e.data.getLocalPosition(this.viewer.stage);
        this.dest = {
            x: gamePos.x - this.viewer.cam.x.get(),
            y: gamePos.y - this.viewer.cam.y.get()
        };
        if (Math.abs(this.dest.x) < 10 && Math.abs(this.dest.y) < 10) {
            this.dest = {
                x: 0,
                y: 0
            };
        }
        this.move();
    }
};

function Controller(client) {
    this.client = client;

    this.server = {
        region: 'EU-London',
        ip: '127.0.0.1',
        port: 9158
    };
    this.nick = 'agario-client';
    this.autoRespawn = false;

    this.gui = new dat.GUI();

    this.servgui = this.gui.addFolder('Server');
    this.servgui.add(this.server, 'region', ['US-Fremont', 'US-Atlanta', 'BR-Brazil', 'EU-London', 'RU-Russia', 'JP-Tokyo', 'CN-China', 'SG-Singapore', 'TK-Turkey']);
    this.servgui.add(this, 'findServer');
    this.servgui.add(this.server, 'ip');
    this.servgui.add(this.server, 'port');
    this.servgui.add(this, 'connect');
    this.servgui.add(this, 'disconnect');
    this.servgui.open();

    this.cellgui = this.gui.addFolder('Cell');
    this.cellgui.add(this, 'nick');
    this.cellgui.add(this, 'spawn');
    this.cellgui.add(this, 'autoRespawn');
    var scoreGui = this.cellgui.add(this.client, 'score').listen();
    this.client.on('scoreUpdate', function () {
        scoreGui.updateDisplay();
    });

    this.leadergui = this.gui.addFolder('Leaderboard');
    this.leaders = {};
    this.resetLeader();
    for (var i = 1; i <= 10; i++) {
        this.leadergui.add(this.leaders, i);
    }

    var _this = this;
    client.on('connected', function () {
        _this.servgui.close();
        _this.cellgui.open();
        _this.leadergui.open();
        if (_this.autoRespawn) {
            _this.spawn();
        }
    });
    client.on('reset', function () {
        _this.servgui.open();
        _this.cellgui.close();
        _this.leadergui.close();
        _this.resetLeader();
    });
    client.on('lostMyBalls', function () {
        if (_this.autoRespawn) {
            _this.spawn();
        }
    });
    client.on('leaderBoardUpdate', function (old, leaders) {
        for (var i in leaders) {
            var rank = parseInt(i) + 1;
            _this.leaders[rank] = this.balls[leaders[i]].name || 'An unnamed cell';
            for (var j in _this.leadergui.__controllers) {
                _this.leadergui.__controllers[j].updateDisplay();
            }
        }
    });
}

Controller.prototype = {
    findServer: function () {
        // Because of SOP, this will never work
        x = new XMLHttpRequest();
        x.open('POST', 'http://m.agar.io', false);
        x.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        x.setRequestHeader('Content-Length', this.server.region.length);
        // x.setRequestHeader('Origin', 'http://agar.io');
        // x.setRequestHeader('Referer', 'http://agar.io/');
        x.send(this.server.region);
        s = x.responseText.split(':');
        this.server.ip = s[0];
        this.server.port = s[1];

        for (var i in this.servgui.__controllers) {
            this.servgui.__controllers[i].updateDisplay();
        }
    },
    connect: function () {
        this.client.connect('ws://' + this.server.ip + ':' + this.server.port);
    },
    disconnect: function () {
        this.client.disconnect();
    },
    spawn: function () {
        this.client.spawn(this.nick);
    },
    resetLeader: function () {
        for (var i = 1; i <= 10; i++) {
            this.leaders[i] = '---';
        }
    }
};

function IA(client) {
    this.client = client;
    this.begin();
}

IA.prototype = {
    begin: function () {
        var _this = this;
        this.interval = setInterval(function () {
            _this.food();
            // _this.decide();
        }, 100);
    },
    end: function () {
        clearInterval(this.interval_id);
    },
    getDistanceBetweenBalls: function (ball_1, ball_2) { //this calculates distance between 2 balls
        return Math.sqrt(Math.pow(ball_1.x - ball_2.x, 2) + Math.pow(ball_2.y - ball_1.y, 2));
    },
    getAngleBetweenBalls: function (b1, b2) { // output in rad
        dX = b2.x - b1.x;
        dY = b2.y - b1.y;
        return Math.tan(dY / dX);
    },
    food: function () {
        var candidate_ball = null; //first we don't have candidate to eat
        var candidate_distance = 0;
        var my_ball = this.client.balls[this.client.my_balls[0]]; //we get our first ball. We don't care if there more then one, its just example.
        if (!my_ball) return; //if our ball not spawned yet then we abort. We will come back here in 100ms later

        for (var ball_id in this.client.balls) { //we go true all balls we know about
            var ball = this.client.balls[ball_id];
            if (ball.virus) continue; //if ball is a virus (green non edible thing) then we skip it
            if (!ball.visible) continue; //if ball is not on our screen (field of view) then we skip it
            if (ball.mine) continue; //if ball is our ball - then we skip it
            if (ball.size / my_ball.size > 0.5) continue; //if ball is bigger than 50% of our size - then we skip it
            var distance = this.getDistanceBetweenBalls(ball, my_ball); //we calculate distances between our ball and candidate
            if (candidate_ball && distance > candidate_distance) continue; //if we do have some candidate and distance to it smaller, than distance to this ball, we skip it

            candidate_ball = ball; //we found new candidate and we record him
            candidate_distance = this.getDistanceBetweenBalls(ball, my_ball); //we record distance to him to compare it with other balls
        }
        if (!candidate_ball) return; //if we didn't find any candidate, we abort. We will come back here in 100ms later

        this.client.log('closest ' + candidate_ball + ', distance ' + candidate_distance);
        this.client.moveTo(candidate_ball.x, candidate_ball.y); //we send move command to move to food's coordinates
    },
    decide: function () {
        var my_ball = this.client.balls[this.client.my_balls[0]]; // TODO Handle more balls
        if (!my_ball) return;
        var candidates = [];

        for (var ball_id in this.client.balls) {
            var ball = this.client.balls[ball_id];
            if (!ball.visible) continue;

            var score = 0;
            if (ball.mine) {
                score = 1;
            } else {
                if (ball.virus) {
                    if (ball.size > my_ball.size) {
                        score = -5;
                    } else {
                        score = 5;
                    }
                } else {
                    score = Math.max(1000 - this.getDistanceBetweenBalls(ball, my_ball) - ball.size - my_ball.size, 0);
                    if (ball.size < my_ball.size) {
                        score = score;
                    } else {
                        score = -score * 5;
                    }
                }
            }

            candidates.push({
                x: ball.x - my_ball.x,
                y: ball.y - my_ball.y,
                score: score
            });
        }

        var x = y = p = 0;
        for (var candidate_id in candidates) {
            var candidate = candidates[candidate_id];
            // console.log(candidate.x, candidate.y, candidate.score)
            x += candidate.x * candidate.score;
            y += candidate.y * candidate.score;
            p += candidate.score;
        }
        this.client.moveTo(my_ball.x + x / p, my_ball.y + y / p);
    }
};

var d = {}; // DEBUG Allow access from console
window.onload = function () {
    d.client = new Client('worker');
    d.viewer = new Viewer(d.client, document.getElementById('viewer'));
    d.controller = new Controller(d.client);
    d.pointer = new Pointer(d.viewer);
    // d.ia = new IA(d.client);
};
