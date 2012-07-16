// imager french

var W = 500;
var H = 400;
var TILEH = 39;
var TILEW = 39.75;

var meImg = null;
var Me = null;
var haveTiles = [];
var chmap = [];
var levelMap = null;
var fieldEl = null;
var overlayEl = null;
var playState = -1; // 0 = playing, 1 = dead, 2 = waiting on next level
var level = -1;
var myFacing = [-1, 0]; // [0] = y, [1] = x
var myDirection = [0, 0]; // [0] = y, [1] = x
var myPosition = null;
var paused = false;
var signAreas = null;
var wordsUsed = null;
var enemies = null;

var pointsmap = [
	1, 3, 4, 1, 1, 4, 3, 2, 1, 10, //j
	4, 1, 2, 1, 1, 5, 10, 1, 1, 1, //t
	3, 3, 4, 8, 8, 10
];

for (var i = 0; i < 26; ++i) {
	haveTiles.push(0);
	chmap.push(String.fromCharCode(65 + i));
}

function within(area, pos) {
	return (area.x >= pos.x && pos.x < area.x + area.w) &&
		(area.y >= pos.y && pos.y < area.y + area.h);
}

function LetterQ() {
	this.ui = null;
	this.to = null;
	this.word = ''; this.score = 0;
}
LetterQ.prototype.addFadeMsg = function(msg, color) {
	var g = $("#game").offset(), offs = this.ui.offset();
	var left = offs.left - g.left;
	var top = offs.top - g.top;
	var e = $("<div class='fademsg'>").appendTo(overlayEl);
	e.text(msg).css({top: top, left: left, color: color});
	setTimeout(function() {
		e.animate({top: top-20, opacity: 0}, 500, function() {
			e.remove();
		});
	}, 50);
};
LetterQ.prototype.clearTO = function() {
	if (this.to === null) return;
	clearTimeout(this.to);
	this.to = null;
};
LetterQ.prototype.add = function(letter, done, min) {
	this.clearTO();
	this.word += String.fromCharCode(letter+97);
	this.score += pointsmap[letter];
	this.ui.text(this.word);
	var word = this.word, totScore = this.score, remScore = 0;
	for (var i = 0; i < word.length; ++i) {
		if (totScore - remScore < min) break;
		if (WordList.indexOf(word.substr(i)) !== -1) {
			this.word = ''; this.score = 0;
			this.addFadeMsg(word.substr(i), 'green');
			this.ui.empty();
			this.to = setTimeout(done);
			return;
		}
		remScore += pointsmap[word.charCodeAt(i)-97];
	}

	var lastCorrect = (WordList.indexOf(word) !== -1);
	var self = this;
	this.to = setTimeout(function() {
		self.word = ''; self.score = 0;
		var err = '';
		if (!lastCorrect) {
			if (word === "imager")
				err = "French is not allowed";
			else
				err = "invalid word " + word;
		}
		else if (totScore < min) {
			err = "score too low";
		}
		self.addFadeMsg(err, 'red');
		self.ui.empty();
	}, 1100);
};

function Enemy(type, pos, move) {
	this.pos = pos;
	this.move = move;
	this.type = type;
	this.letterQ = new LetterQ();
	if (type === '0')
		this.hitbox = {x: 0, y: 0, w: TILEW, h: TILEH};
	else if (type === 'small')
		this.hitbox = {x: 10, y: 10, w: 10, h: 10};
	else if (type === 'me')
		this.hitbox = {x: 6, y: 6, w: 27, h: 27};
	else if (type === 'tile')
		this.hitbox = {x: 3, y: 3, w: 33, h: 33};
	else if (type === 'message')
		this.hitbox = {x: 4, y: 4, w: 12, h: 12};
	else if (type === 'end')
		this.hitbox = {x: 4, y: 4, w: 31, h: 31};
}

function sq(x) { return x*x; }

Enemy.prototype.remove = function() {
	this.letterQ.clearTO();
	this.el.remove();
};

Enemy.prototype.setPos = function() {
	this.el.css({
		'left': this.pos.x,
		'top': this.pos.y
	});
};

Enemy.prototype.addLetter = function(letter, done, min) {
	this.letterQ.add(letter, done, min);
};

Enemy.prototype.makeHolder = function() {
	this.el = $("<div class='enemy'>").addClass("enemy-" + this.type)
		.appendTo($("#enemies"));
	this.letterQ.ui = $("<div class='q-msg'>").appendTo(this.el);
	this.setPos();
};

function modmid(a, b) {
	var res = a % b;
	if (res > b/2) res -= b;
	if (res < -b/2) res += b;
	return res;
}

function overlap(r1, r2) {
	if (r1.x+r1.w <= r2.x) return false;
	if (r2.x+r2.w <= r1.x) return false;
	if (r1.y+r1.h <= r2.y) return false;
	if (r2.y+r2.h <= r1.y) return false;
	return true;
}

Enemy.prototype.getRect = function() {
	var rpos = this.pos;
	var hb = this.hitbox;
	return {x: rpos.x + hb.x, y: rpos.y + hb.x, w: hb.w, h: hb.h};
};

function areaFail(rect) {
	var scrw = TILEW*levelMap[0].length;
	var scrh = TILEH*levelMap.length;
	if (rect.x < 0) return true;
	if (rect.y < 0) return true;
	if (rect.x + rect.w >= scrw) return true;
	if (rect.y + rect.h >= scrh) return true;
	for (var i = 0; i < levelMap.length; ++i) {
		var row = levelMap[i];
		for (var j = 0; j < row.length; ++j) {
			if (row[j] !== '#' && row[j] !== '0') continue;
			var area = {y: TILEH*i, x: TILEW*j, w: TILEW, h: TILEH};
			if (overlap(area, rect))
				return true;
		}
	}
	return false;
}

Enemy.prototype.wallMove = function(dx, dy) {
	var rpos = this.pos;
	rpos.x += dx;
	if (areaFail(this.getRect())) rpos.x -= dx;
	rpos.y += dy;
	if (areaFail(this.getRect())) rpos.y -= dy;
};

function setMeImg() {
	var src = 'img/me'+myFacing[0]+myFacing[1]+'.png';
	if (meImg.attr('src') === src) return;
	meImg.attr('src', src);
	meImg.attr('data-facing', ''+myFacing[0]+myFacing[1]);
}

function makeMeEnemy(pos) {
	return new Enemy('me', pos, function() {
		var sp = 4;
		this.wallMove(myDirection[1]*sp, myDirection[0]*sp);
	});
}

function makeMessageEnemy(midpos, tile, dir) {
	var e = new Enemy('message', midpos, function() {
		var sp = 14;
		this.pos.x += dir[1] * sp;
		this.pos.y += dir[0] * sp;
	});
	e.pos.x -= e.hitbox.w/2;
	e.pos.y -= e.hitbox.h/2;
	e.tile = tile;
	return e;
}

function makeTileEnemy(pos, tile) {
	var e = new Enemy('tile', pos, function() {});
	e.tile = tile;
	return e;
}

function makeCycleMove(ar, speed) {
	var ind = 0;
	return function() {
		var cur = this.pos, next = ar[ind]; var d = sq(cur.x-next.x) + sq(cur.y-next.y); var sp2 = sq(speed);
		if (d < sp2) {
			this.pos = next;
			++ind;
			ind %= ar.length;
		}
		else {
			cur.x += (next.x-cur.x)*(sp2 / d);
			cur.y += (next.y-cur.y)*(sp2 / d);
		}
	};
}

function renderTiles() {
	var vis = [];
	haveTiles.forEach(function(n, i) {
		if (!n) return;
		var p = haveTiles[i];
		if (p > 1e8) p = "&infty;";
		vis.push("<div class='havetile'><div>" + chmap[i] + "</div><span class='points'>" + pointsmap[i] + "</span>" + "</div> x" + p);
	});
	var html = "";
	for (var i = 0; i < vis.length; ++i) {
		html += "<div class='tileholder'>" + vis[i] + "</div>";
	}
	$("#inv").html(html);
}

function render() {
	// TODO move messages etc.
}

function renderloop() {
	render();
	// window.mozRequestAnimationFrame = renderloop;
}

function shootTile(ch) {
	--haveTiles[ch];
	renderTiles();
	var pos = {x: Me.pos.x+Me.hitbox.w/2, y: Me.pos.y+Me.hitbox.h/2};
	var e = makeMessageEnemy(pos, ch, myFacing);
	e.makeHolder();
	e.el.text(String.fromCharCode(ch + 65));
	enemies.push(e);
}

function keyPress(e) {
	var cc = e.charCode;
	if (cc >= 97 && cc < 97+26) cc -= 32;
	var k = String.fromCharCode(cc);
	if (playState < 2 && e.keyCode === 13) {
		// Restart
		destroyLevel();
		loadLevel(level);
	}
	else if (playState === 0) {
		if (paused) {
			if (k === 'k') {
				paused = false;
				$("#covermsg").hide();
			}
		}
		else {
			if (e.keyCode === 13) {
				for (var i = 0; i < signAreas.length; ++i) {
					var s = signAreas[i];
					if (within(s, myPosition)) {
						paused = true;
						$("#covermsg").html(
							"<div id='signmsg'>" + s.text + "</div>"
						).show();
						return;
					}
				}
			}
			else if (cc >= 65 && cc < 65 + 26) {
				var ch = cc - 65;
				if (haveTiles[ch] > 0)
					shootTile(ch);
			}
		}
	}
	else if (playState === 2) {
		if (k === ' ') {
			destroyLevel();
			loadLevel(level+1===Levels.length ? 0 : level+1);
		}
	}
}

function keyDown(e) {
	if (e.which === 65 && e.ctrlKey) return false;
	if (playState === 0 && !paused) {
		var setDir = false;
		if (e.which === 38 && myDirection[0] !== -1) {
			myDirection[0] = -1;
			setDir = !myDirection[1];
		}
		else if (e.which === 40 && myDirection[0] !== 1) {
			myDirection[0] = 1;
			setDir = !myDirection[1];
		}
		else if (e.which === 37 && myDirection[1] !== -1) {
			myDirection[1] = -1;
			setDir = !myDirection[0];
		}
		else if (e.which === 39 && myDirection[1] !== 1) {
			myDirection[1] = 1;
			setDir = !myDirection[0];
		}
		if (setDir) {
			myFacing = myDirection.slice();
			setMeImg();
		}
	}
}

function keyUp(e) {
	if (playState === 0 && !paused) {
		if (e.which === 38 && myDirection[0] === -1)
			myDirection[0] = 0;
		else if (e.which === 40 && myDirection[0] === 1)
			myDirection[0] = 0;
		else if (e.which === 37 && myDirection[1] === -1)
			myDirection[1] = 0;
		else if (e.which === 39 && myDirection[1] === 1)
			myDirection[1] = 0;

		if (((myFacing[0] && myFacing[0] !== myDirection[0]) ||
			(myFacing[1] && myFacing[1] !== myDirection[1])) &&
			(myDirection[0] || myDirection[1]))
		{
			// Facing somewhere we are not walking - readjust.
			myFacing = [0, 0];
			var axis = myFacing[0] ? 1 : 0;
			myFacing[axis] = myDirection[axis];
			setMeImg();
		}
	}
}

function levelWin() {
	playState = 2;
	var msg = "Level complete!<br>Press SPACE to continue.";
	if (level+1 === Levels.length) {
		msg = "Game complete!";
	}
	$("#covermsg").show().html(msg);
}

function logic() {
	if (playState !== 0 || paused) return;
	var t0 = Date.now();
	for (var i = 0; i < enemies.length; ++i) {
		var e = enemies[i];
		e.move();
		e.setPos();
	}
	for (var i = 0; i < enemies.length; ++i) {
		var e1 = enemies[i];
		for (var j = 0; j < enemies.length; ++j) {
			var e2 = enemies[j];
			if (e1 === e2 || !overlap(e1.getRect(), e2.getRect())) continue;
			var rem = (function() {
				if (e1.type === 'me') {
					if (e2.type === 'tile') {
						++haveTiles[e2.tile];
						renderTiles();
						return 2;
					}
					else if (e2.type === 'end') {
						levelWin();
						return;
					}
				}
				else if (e2.type === 'me') return;

				if (e1.type === 'message') {
					if (e2.type === 'tile') return 2;
					if (e2.type === '0') {
						(function() {
							var e = e2;
							e.addLetter(e1.tile, function() {
								var s = levelMap[e.ty];
								levelMap[e.ty] = s.substr(0, e.tx) + ' ' + s.substr(e.tx+1);
								e.td.removeClass('tile-0').addClass('tile-bg').text('');
								var ind = enemies.indexOf(e);
								if (ind === -1) alert("fail");
								e.remove();
								enemies.splice(ind, 1);
							}, e.needed);
						})();
						return 1;
					}
				}
			})();
			if (rem&2) {
				e2.remove();
				enemies.splice(j, 1);
				if (i > j) --i;
				--j;
			}
			if (rem&1) {
				e1.remove();
				enemies.splice(i, 1);
				--i;
				break;
			}
		}
	}

	// Messages
	for (var i = 0; i < enemies.length; ++i) {
		var m = enemies[i];
		if (m.type !== 'message') continue;
		var rect = m.getRect();
		if (areaFail(rect)) {
			m.remove();
			enemies.splice(i, 1);
			--i;
		}
	}

	// enemies shooting sometimes
	var t1 = Date.now();
	Timing += t1-t0;
	TimingT++;
}
var Timing = 0;
var TimingT = 0;

function getT() { return Timing/TimingT; }

var Levels = [
	{
		map: [
			'#   T#     #',
			'#   T# TTT #',
			'# S T0 T T #',
			'#   T#     #',
			'#   T###0###',
			'#######  T #',
			'#     # T T#',
			'#  E  0T T #',
			'#     # T T#',
			'#     #    #'
		],
		special: ['T', 'L', 'U', 'N', 'I', 'Y', 12, 'T', 'P', 'E', 'S', 11,
		'S', 'E', 'I', 10, 'D', 'C', 'N', 'I']
	}
];

function destroyLevel() {
	enemies.forEach(function(e) {
		e.remove();
	});
}

function loadLevel(lv) {
	overlayEl.empty();
	level = lv;
	var lvi = Levels[lv], spc = 0;
	paused = false;
	playState = 0;
	wordsUsed = [];
	enemies = [];
	signAreas = lvi.signAreas || [];
	$("#covermsg").hide();
	var m = lvi.map;
	levelMap = m.slice();
	var ltiles = [];
	var mePos;
	myDirection = [0, 0];
	myFacing = [-1, 0];
	var Bg = $("#bg").empty();
	for (var i = 0; i < 26; ++i) haveTiles[i] = 0;
	for (var i = 0; i < m.length; ++i) {
		var s = m[i];
		var tr = $("<tr>").appendTo(Bg);
		for (var j = 0; j < s.length; ++j) {
			var c = s[j], cl = (c === ' ' ? 'bg' : c === '#' ? 'wall' : c);
			var td = $("<td>").addClass("bgtile tile-" + cl).appendTo(tr);
			var pos = {y: TILEH*i, x: TILEW*j};
			if (c === '0') {
				var needed = lvi.special[spc++];
				td.html("<span><span>" + needed + "</span></span>");
				var e = new Enemy('0', pos, function() {});
				e.ty = i;
				e.tx = j;
				e.td = td;
				e.needed = needed;
				enemies.push(e);
			}
			else if (c === 'T') {
				var tile = lvi.special[spc++];
				enemies.push(makeTileEnemy(pos, String.charCodeAt(tile)-65));
			}
			else if (c === 'E') {
				enemies.push(new Enemy('end', pos, function() {}));
			}
			else if (c === 'S') {
				mePos = pos;
			}
		}
	}
	var me = makeMeEnemy(mePos);
	enemies.push(me);
	Me = me;
	var Eholder = $("#enemies").empty();
	for (var i = 0; i < enemies.length; ++i) {
		var e = enemies[i];
		e.makeHolder();
		if (e.type === 'tile')
			e.el.text(String.fromCharCode(e.tile+65));
		else if (e.type === 'me') {
			meImg = $("<img alt='<you>'>");
			setMeImg();
			meImg.appendTo(e.el);
		}
	}
	renderTiles();
}

$(function() {
	fieldEl = $("#field");
	overlayEl = $("#overlay");
	renderloop();
	$(window).keypress(keyPress).keydown(keyDown).keyup(keyUp);
	loadLevel(0);
	setInterval(logic, 20);
});
