// "sound" as comment

var W = 500;
var H = 400;
var TILEH = 39;
var TILEW = 39.75;

var blockMeMovement = false;
var Lvi;
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
var lvTemp = {};

var pointsmap = [
	1, 3, 4, 1, 1, 4, 3, 2, 1, 10, //j
	4, 1, 2, 1, 1, 5, 10, 1, 1, 1, //t
	3, 3, 4, 8, 8, 10
];

var bossWords = [
	"temporary", "damaging", "indirection", "clumpsyness",
	"animosity", "querulousness", "assumption",
	"miraculous", "usefulness", "simplicity",
	"territory", "groundbreaking", "assemblage",
	"metamorphosis", "miniscule", "diaphanous",
	"ebullience", "ephemeral", "eloquence", "penumbra",
	"quintessential", "serendipity", "labyrinthine"
], bossWc = 0;

function shuffle(ar) {
	var t0, t1, i, len = ar.length;
	for (i = 0; i < len-1; ++i) {
		var r = Math.floor(Math.random() * (len - i)) + i;
		t0 = bossWords[r]; t1 = bossWords[i];
		bossWords[r] = t1; bossWords[i] = t0;
	}
}
shuffle(bossWords);

for (var i = 0; i < 26; ++i) {
	haveTiles.push(0);
	chmap.push(String.fromCharCode(65 + i));
}

function sco(word) {
	var sum = 0;
	for (var i = 0; i < word.length; ++i)
		sum += pointsmap[word.charCodeAt(i)-97];
	return sum;
}

function preload() {
	var ar = ["me0-1.png", "me01.png", "me-10.png", "me10.png", "me-orig.png", "me.png",
	"small-def0.png", "small-def1.png", "small.png", "spikes.png"];
	for (var i = 0; i < ar.length; ++i)
		new Image().src = "img/" + ar[i];
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
LetterQ.prototype.addFadeMsg = function(msg, color, bold) {
	var g = $("#game").offset(), offs = this.ui.offset();
	var left = offs.left - g.left;
	var top = offs.top - g.top;
	var e = $("<div class='fademsg'>").appendTo(overlayEl);
	e.text(msg).css({top: top, left: left, color: color, fontWeight: (bold ? 'bold' : 'normal')});
	levelTimeout(function() {
		e.animate({top: top-20, opacity: 0}, 500);
		levelTimeout(function() {
			e.remove();
		}, 500);
	}, 50);
};
LetterQ.prototype.clearTO = function() {
	if (this.to === null) return;
	clearTimeout(this.to);
	this.to = null;
};
LetterQ.prototype.add = function(letter, done, type, min, check) {
	// sound
	var Sc = (type === 'S');
	this.clearTO();
	if (!min) {
		this.addFadeMsg("BAM", 'green');
		this.to = setTimeout(done);
		return;
	}
	this.word += String.fromCharCode(letter+97);
	this.score += pointsmap[letter];
	this.ui.text(this.word);
	var word = this.word, totScore = this.score, remScore = 0;
	if (type === 'W') {
		if (!check) return;
		if (!this.counter) this.counter = check;
		--this.counter;
		if (this.counter) return;
		if (this.word.length === min.length) {
			var self = this;
			this.to = setTimeout(function() {
				self.word = ''; self.score = 0;
				self.addFadeMsg(min, 'red', true);
				self.ui.empty();
				done();
			});
		}
		else {
			this.word = ''; this.score = 0;
			this.addFadeMsg("Invalid word", 'black', true);
			this.ui.empty();
			return;
		}
		return;
	}

	for (var i = 0; i < word.length; ++i) {
		if (Sc && totScore - remScore < min) break;
		if (!Sc && word.length-i < min) break;
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
		else if (Sc) {
			err = "score too low";
		}
		else if (!Sc) {
			err = "Too short";
		}
		self.addFadeMsg(err, 'red');
		self.ui.empty();
	}, 1100);
};

function Enemy(type, pos, move) {
	this.stunUntil = 0;
	this.pos = pos;
	this.move = move;
	this.type = type;
	this.letterQ = new LetterQ();
	if (type === '0')
		this.hitbox = {x: 0, y: 0, w: TILEW, h: TILEH};
	else if (type === 'small')
		this.hitbox = {x: 8, y: 8, w: 24, h: 24};
	else if (type === 'me')
		this.hitbox = {x: 6, y: 6, w: 27, h: 27};
	else if (type === 'tile')
		this.hitbox = {x: 3, y: 3, w: 33, h: 33};
	else if (type === 'message')
		this.hitbox = {x: 2, y: 2, w: 16, h: 16};
	else if (type === 'end')
		this.hitbox = {x: 4, y: 4, w: 31, h: 31};
	else if (type === 'spikes')
		this.hitbox = {x: 4, y: 4, w: 31, h: 31};
	else if (type === 'shield')
		this.hitbox = {x: 4, y: 4, w: 31, h: 31};
	else if (type === 'mirror')
		this.hitbox = {x: 0, y: 0, h: 40, w: 30};
	else if (type === 'boss')
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

Enemy.prototype.isStunned = function() {
	return (this.stunUntil > Date.now());
};

Enemy.prototype.addLetter = function(letter, done, type, min, stunDir, check, stunLonger) {
	this.letterQ.add(letter, done, type, min, check);
	if (stunDir) {
		if (this.stunUntil + 140 <= Date.now()) {
			this.wallMove(stunDir.x, stunDir.y, false);
			this.wallMove(stunDir.x, stunDir.y, false);
			this.setPos();
		}
		var stunTime = (stunLonger ? 1250 : 300);
		this.el.attr('data-stunned', 1);
		this.stunned = true;
		var prev = this.stunUntil, wasStunned = this.isStunned();
		this.stunUntil = Date.now() + stunTime;
		return (wasStunned ? this.stunUntil - prev : stunTime);
	}
	return 0;
};

Enemy.prototype.makeHolder = function() {
	this.el = $("<div class='enemy'>").addClass("enemy-" + this.type)
		.appendTo($("#enemies"));
	this.letterQ.ui = $("<div class='q-msg'>").appendTo(this.el);
	this.setPos();
	return this;
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

function areaFail(rect, allowOutside) {
	if (!allowOutside) {
		var scrw = TILEW*levelMap[0].length;
		var scrh = TILEH*levelMap.length;
		if (rect.x < 0) return true;
		if (rect.y < 0) return true;
		if (rect.x + rect.w >= scrw) return true;
		if (rect.y + rect.h >= scrh) return true;
	}
	for (var i = 0; i < levelMap.length; ++i) {
		var row = levelMap[i];
		for (var j = 0; j < row.length; ++j) {
			if ("#01-M".indexOf(row[j]) === -1) continue;
			var area = {y: TILEH*i, x: TILEW*j, w: TILEW, h: TILEH};
			if (overlap(area, rect))
				return true;
		}
	}
	return false;
}

Enemy.prototype.wallMove = function(dx, dy, ignoreWalls) {
	var rpos = this.pos;
	rpos.x += dx;
	if (areaFail(this.getRect(), ignoreWalls)) rpos.x -= dx;
	rpos.y += dy;
	if (areaFail(this.getRect(), ignoreWalls)) rpos.y -= dy;
};

function setMeImg() {
	var src = 'img/me'+myFacing[0]+myFacing[1]+'.png';
	if (meImg.attr('src') === src) return;
	meImg.attr('src', src);
	meImg.attr('data-facing', ''+myFacing[0]+myFacing[1]);
}

function makeMeEnemy(pos) {
	var e = new Enemy('me', pos, function() {
		var sp = 4;
		if (blockMeMovement) return;
		this.wallMove(myDirection[1]*sp, myDirection[0]*sp, false);
	}).makeHolder();
	meImg = $("<img alt='<you>'>");
	setMeImg();
	meImg.appendTo(e.el);
	return e;
}

function makeSpikesEnemy(pos) {
	return new Enemy('spikes', pos, function() {}).makeHolder();
}

function makeShieldEnemy(pos, vert, from, to) {
	var pos1 = {x: pos.x, y: pos.y};
	var pos2 = {x: pos.x, y: pos.y};
	var dim = vert ? 'y' : 'x', sz = vert ? TILEH : TILEW;
	pos1[dim] = from * sz;
	pos2[dim] = to * sz;
	var e = new Enemy('shield', pos, makeCycleMove([pos1, pos2], 1)).makeHolder();
	e.el.attr('data-vert', vert?1:0);
	e.vert = vert;
	return e;
}

function makeMessageEnemy(midpos, tile, dir) {
	var sp2 = 2.5;
	var e = new Enemy('message', midpos, function() {
		var sp = 14;
		this.pos.x += this.Ydir[1] * sp;
		this.pos.y += this.Ydir[0] * sp;
	});
	e.Ydir = [dir[0], dir[1]];
	e.own = true;
	e.pos.x -= e.hitbox.w/2;
	e.pos.y -= e.hitbox.h/2;
	e.tile = tile;
	e.vert = !!dir[0];
	e.stunDir = {x: dir[1] * sp2, y: dir[0] * sp2};
	e.makeHolder();
	e.el.text(String.fromCharCode(tile + 65));
	return e;
}

function makeBossMessageEnemy(midpos, tile, dir, word) {
	var lpos = {x: midpos.x, y: midpos.y};
	var i = 1;
	var e = new Enemy('message', {x:0, y:0}, function() {
		var sp = 10;
		lpos.x -= dir[1] * sp;
		lpos.y -= dir[0] * sp;
		this.pos.x = i*lpos.x + (1-i)*Me.pos.x;
		this.pos.y = i*lpos.y + (1-i)*Me.pos.y;
		i -= 0.03;
	});
	e.boss = true;
	e.word = word;
	lpos.x -= e.hitbox.w/2;
	lpos.y -= e.hitbox.h/2;
	e.pos.x = lpos.x;
	e.pos.y = lpos.y;
	e.tile = tile;
	e.makeHolder();
	e.el.text(String.fromCharCode(tile + 65));
	return e;
}

function makeMirrorEnemy(pos) {
	return new Enemy('mirror', pos, function() {}).makeHolder();
}

function makeTileEnemy(pos, tile) {
	var e = new Enemy('tile', pos, function() {});
	e.tile = tile;
	e.makeHolder();
	e.el.text(String.fromCharCode(tile+65));
	return e;
}

function makeOutEnemy(pos, needed, sp) {
	var isOut = false, top = (pos.y < 0);
	var e = new Enemy('small', pos, function() {
		var cur = this.pos;
		if (!isOut) {
			if (top) {
				cur.y += sp;
				isOut = (cur.y > TILEH);
			}
			else {
				cur.y -= sp;
				isOut = (cur.y < TILEH*(Lvi.map.length-2));
			}
		}
		else {
			var next = Me.pos;
			var d = Math.sqrt(sq(cur.x-next.x) + sq(cur.y-next.y));
			var m = sp/d;
			this.wallMove((next.x-cur.x)*m, (next.y-cur.y)*m, false);
		}
	});
	e.needed = needed;
	e.makeHolder();
	if (needed)
		e.el.prepend(needed);
	return e;
}

/*
function makeAgainstEnemy(pos, needed, sp) {
	var isOut = false, top = (pos.y < 0);
	var e = new Enemy('small', pos, function() {
		var cur = this.pos;
		if (!isOut) {
			if (top) {
				cur.y += sp;
				isOut = (cur.y > TILEH);
			}
			else {
				cur.y -= sp;
				isOut = (cur.y < TILEH*(Lvi.map.length-2));
			}
		}
		else {
			var next = Me.pos;
			var d = Math.sqrt(sq(cur.x-next.x) + sq(cur.y-next.y));
			cur.x += (next.x-cur.x)*sp / d;
			cur.y += (next.y-cur.y)*sp / d;
		}
	});
	e.needed = needed;
	e.makeHolder();
	if (needed)
		e.el.prepend(needed);
	return e;
}
*/

function makeCycleMove(ar, speed) {
	var ind = 0;
	return function() {
		var cur = this.pos, next = ar[ind];
		var d = Math.sqrt(sq(cur.x-next.x) + sq(cur.y-next.y));
		if (d < speed) {
			cur.x = next.x;
			cur.y = next.y;
			++ind;
			ind %= ar.length;
		}
		else {
			cur.x += (next.x-cur.x)*speed / d;
			cur.y += (next.y-cur.y)*speed / d;
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
		if (e.keyCode === 13) {
			if (level !== -1) destroyLevel();
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
			if (!myDirection[axis]) axis ^= 1;
			myFacing[axis] = myDirection[axis];
			setMeImg();
		}
	}
}

function levelWin() {
	playState = 2;
	var msg = "Level complete!<br>Press ENTER to continue.";
	if (level+1 === Levels.length) {
		msg = "Game complete!";
	}
	$("#covermsg").html(msg).show();
}

function levelLose() {
	playState = 1;
	var msg = "You died!<br>Press ENTER to retry.";
	$("#covermsg").html(msg).show();
}

function tilePos(x, y) {
	return {x: x*TILEW, y: y*TILEH};
}

function removeWall(x, y) {
	var td = $($("#bg tr")[y].childNodes[x]);
	var s = levelMap[y];
	levelMap[y] = s.substr(0, x) + ' ' + s.substr(x+1);
	td.removeClass().addClass('bgtile tile-bg').text('');
}
function addWall(x, y) {
	var td = $($("#bg tr")[y].childNodes[x]);
	var s = levelMap[y];
	levelMap[y] = s.substr(0, x) + '#' + s.substr(x+1);
	td.removeClass().addClass('bgtile tile-wall').text('');
}

var TO = [];
function levelTimeout(f, t) {
	var wr = function() {
		var ind = TO.indexOf(to);
		if (ind !== -1) TO.splice(ind, 1);
		f();
	};
	var to = setTimeout(wr, t);
	TO.push(to);
}

function makeBossEnemy() {
	var bossw = 38, bossh = 40;
	var bImg = $("<img alt=''>");
	function teleport() {
		boss.pos.x = TILEW*(Lvi.map[0].length) - Me.pos.x - bossw;
		boss.pos.y = TILEH*(Lvi.map.length) - Me.pos.y - bossh;

		var src = 'img/me'+(-myFacing[0])+(-myFacing[1])+'.png';
		if (bImg.attr('src') === src) return;
		bImg.attr('src', src);
		bImg.attr('data-facing', ''+(-myFacing[0])+(-myFacing[1]));
	}
	var boss = lvTemp.boss = new Enemy('boss', {x: 0, y: 0}, function() {
		teleport();
	});
	teleport();
	boss.makeHolder();
	bImg.appendTo(boss.el);
	return boss;
}

function bossLevelInit() {
	myFacing = [0, 1];
	lvTemp.stage = 0;
	lvTemp.rage = 0;
}

function bossLevelLogic() {
	function addHP(e, col, orig) {
		var hp = orig;
		var updateHP = function(dmg) {
			hp -= dmg;
			el.css('width', Math.max(hp/orig*100, 0) + '%');
			if (hp <= 0) {
				if (e === Me) levelLose();
				else levelWin();
			}
			return hp;
		};
		var el = $("<div class='hp'>").css('background-color', col).appendTo(e.el);
		updateHP(0);
		return updateHP;
	}

	if (lvTemp.stage === 0) {
		if (Me.pos.x > TILEW*1.5) {
			lvTemp.stage = 1;
			blockMeMovement = true;
			lvTemp.upMyHP = addHP(Me, '#0022ee', 100);
			addWall(0, 4, lvTemp.blockTd);
			lvTemp.addRandomTile = function() {
				var c = enemies.filter(function(e) { return e.type === 'tile'; }).length;
				var ar = [[2,3], [4,2], [7,2], [8,3],
				          [2,5], [4,6], [7,6], [8,5]];
				if (c >= ar.length) return;
				var rLetters = [
					0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25, // a-z
					0,5,14,18 // aeos
				];
				var ch = rLetters[Math.floor(Math.random() * rLetters.length)];
				for (;;) {
					var a = ar[Math.floor(Math.random() * ar.length)];
					if (enemies.some(function(e) {
						return e.X === a[0] && e.Y === a[1];
					})) continue;
					var e = makeTileEnemy(tilePos(a[0], a[1]), ch);
					e.X = a[0]; e.Y = a[1];
					enemies.push(e);
					break;
				}
			};
			levelTimeout(function() {
				enemies.push(makeBossEnemy());
				var e = lvTemp.boss;
				lvTemp.upEHP = addHP(e, '#cc0000', 2);
				lvTemp.bossDmg = function() {
					e.stunUntil = 0;
					++lvTemp.rage;
					lvTemp.nextShot = Date.now() + 2500;
					var left = lvTemp.upEHP(1);
					if (!left) {
						e.remove();
						var ind = enemies.indexOf(e);
						enemies.splice(ind, 1);
						levelWin();
					}
				};
				e.el.css('opacity', 0).animate({'opacity': 1}, 1000);
				levelTimeout(function() {
					blockMeMovement = false;
					lvTemp.nextTiles = Date.now();
					lvTemp.nextShot = Date.now() + 2000;
				}, 1000);
			}, 600);
		}
	}

	if (lvTemp.shooting && lvTemp.shooting <= Date.now()) {
		var ch = lvTemp.shootingW.charCodeAt(lvTemp.shootingI++) - 97;
		enemies.push(makeBossMessageEnemy(lvTemp.boss.pos, ch, myFacing, lvTemp.shootingW));
		if (lvTemp.shootingI === lvTemp.shootingW.length)
			lvTemp.shooting = 0;
		else
			lvTemp.shooting += 40;
	}

	if (lvTemp.nextTiles && lvTemp.nextTiles <= Date.now()) {
		lvTemp.addRandomTile();
		lvTemp.addRandomTile();
		lvTemp.addRandomTile();
		lvTemp.nextTiles = 0;
	}

	if (lvTemp.nextShot <= Date.now()) {
		lvTemp.shooting = Date.now();
		lvTemp.shootingW = bossWords[bossWc++];
		lvTemp.shootingI = 0;
		bossWc %= bossWords.length;
		lvTemp.nextShot = Date.now() + (bossWc%2 && lvTemp.rage ? 2000 : 5000);
		lvTemp.nextTiles = Date.now() + 1000;
	}
}

function spawnLevelInit(mePos) {
	lvTemp.stage = 0;
	mePos.x += TILEW/2;
}

function spawnLevelLogic() {
	var end = Lvi.map.length;
	var addTiles = {
		1: [[2,3,'A'], [3,2,'S'], [8,3,'T'], [7,2,'A']],
		4: [[2,3,'S'], [2,5,'E'], [3,6,'R'], [7,6,'S'], [8,5,'E'], [8,3,'W']]
	};
	var addEnemies = { // 2/7, -1/end
		0: [[2,-1,3,2]],
		2: [[2,-1,1,1.7], [7,-1,1,1.7]],
		3: [[7,end,4,2.7]],
		5: [[2,end,sco("sewers"),1.5]]
	};
	if (enemies.every(function(e) { return e.type !== 'tile' && e.type !== 'small'; })) { // empty; spawn things
		if (lvTemp.stage in addEnemies) {
			addEnemies[lvTemp.stage].forEach(function(a) {
				enemies.push(makeOutEnemy(tilePos(a[0], a[1]), a[2], a[3]));
			});
			++lvTemp.stage;
		}
		else if (lvTemp.stage in addTiles) {
			addTiles[lvTemp.stage].forEach(function(a) {
				enemies.push(makeTileEnemy(tilePos(a[0], a[1]), String.charCodeAt(a[2])-65));
			});
			++lvTemp.stage;
		}
		else {
			var beam = lvTemp.theBeam;
			if (beam) {
				// sound
				delete lvTemp.theBeam;
				removeWall(beam.x, beam.y, beam.td);
			}
		}
	}
}

function SInit() {
	lvTemp.step = 0;
}

function SLogic() {
	if (Me.pos.y > 4*TILEH && !lvTemp.spx) {
		lvTemp.spx = 1;
		enemies.push(makeOutEnemy(tilePos(9, 8), 0, 4));
	}

	if (enemies.every(function(e) { return e.type !== 'small'; })) {
		if (lvTemp.step === 3) {
			var beam = lvTemp.theBeam;
			if (beam) {
				// sound
				delete lvTemp.theBeam;
				removeWall(beam.x, beam.y);
			}
		}
	}
}

function SRem0() {
	var s = ++lvTemp.step;
	if (s === 1) {
		enemies.push(makeOutEnemy(tilePos(5, 1), 0, 2.4));
	}
	else if (s === 2) {
		enemies.push(makeOutEnemy(tilePos(3, 8), 0, 3));
	}
	else if (s === 3) {
		enemies.push(makeOutEnemy(tilePos(1, 7), 0, 2.5));
	}
}

function logic() {
	if (playState !== 0 || paused) return;
	var time = Date.now();
	for (var i = 0; i < enemies.length; ++i) {
		var e = enemies[i];
		if (!e.isStunned()) {
			if (e.stunned) {e.el.attr('data-stunned', 0); e.stunned = false; }
			e.move();
			e.setPos();
		}
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
					else if (e2.type === 'small' || e2.type === 'shield' || e2.type === 'boss') {
						levelLose();
						return 1;
					}
					else if (e2.type === 'spikes') {
						levelLose();
						return 1;
					}
					else if (e2.type === 'message' && e2.boss) {
						(function() {
							var e1_ = e1, e2_ = e2;
							e1_.addLetter(e2_.tile, function() {
								lvTemp.upMyHP(30);
							}, 'W', e2_.word, null, e2_.word.length);
						})();
						return 2;
					}
					else if (e2.type === 'message' && !e2.own) {
						(function() {
							var e1_ = e1, e2_ = e2;
							e1_.addLetter(e2_.tile, function() {}, 'S', 1e9, e2.stunDir);
						})();
						return 2;
					}
				}
				else if (e2.type === 'me') return;

				if (e1.type === 'message') {
					if (e2.type === 'tile') return 2;
					if (e2.type === '0') {
						(function() {
							var e = e2;
							e.addLetter(e1.tile, function() {
								removeWall(e.tx, e.ty, e.td);
								var ind = enemies.indexOf(e);
								if (ind === -1) alert("fail");
								e.remove();
								enemies.splice(ind, 1);
								if (Lvi.rem0Logic) Lvi.rem0Logic();
							}, 'L', e.needed, {x: 0, y:0});
						})();
						return 1;
					}
					if (e2.type === 'small') {
						(function() {
							var e = e2;
							e.addLetter(e1.tile, function() {
								var ind = enemies.indexOf(e);
								e.remove();
								enemies.splice(ind, 1);
							}, 'S', e.needed, e1.stunDir);
						})();
						return 1;
					}
					if (e2.type === 'boss' && !e1.boss) {
						(function() {
							var e = e2;
							if (!e1.purple && !e.isStunned()) {
								e.letterQ.addFadeMsg("resist", 'black');
								return;
							}
							var r = lvTemp.rage, needed =
								(r === 0 ? 3 : 6); // r === 1 ? 5 : 7);
							var addStun = e.addLetter(e1.tile, function() {
								lvTemp.bossDmg();
							}, 'L', needed, e1.stunDir, false, true);
							if (lvTemp.shooting) lvTemp.shooting += addStun;
							lvTemp.nextShot += addStun;
						})();
						return 1;
					}
					if (e2.type === 'shield') {
						if (e1.vert !== e2.vert) {
							e2.letterQ.addFadeMsg("BAM", 'green');
							return 3;
						}
						else {
							e2.letterQ.addFadeMsg("block", 'black');
							return 1;
						}
					}
					if (e2.type === 'mirror' && !e1.boss && !(e1.mirror && e1.bouncing())) {
						e1.stunDir.x *= -1;
						e1.Ydir[1] *= -1;
						e1.bouncing = function() {
							return (this.mirror === 'left' && this.pos.x > 400);
						};
						e1.mirror = 'left';
						e1.own = false;
						e1.purple = true;
						e1.el.addClass('purple');
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
		if (m.type !== 'message' || m.boss) continue;
		var rect = m.getRect();
		if (areaFail(rect) && !(m.mirror && m.bouncing())) {
			m.remove();
			enemies.splice(i, 1);
			--i;
		}
	}

	if (Lvi.logic)
		Lvi.logic();

	// enemies shooting sometimes
	var t1 = Date.now();
	Timing += t1-time;
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
		special: ['T', 'L', 'U', 'N', 'I', 'Y', 5, 'T', 'P', 'E', 'S', 5,
		'S', 'E', 'I', 7, 'D', 'C', 'N', 'I']
	},
	{
		// queers, creeds, skewed 
		map: [
			'    TT S# E ',
			'        #   ',
			'  ^^^^^^##0#',
			'  ^TTTT     ',
			'  ^TTTT^ ^^^',
			'  ^TTTT^3^##',
			'  ^^^^^^ ^##',
			'    3    ^##',
		],
		special: ['Z', 'Z', 6, 'E', 'D', 'K', 'S', 'C', 'R', 'U', 'E',
		'W', 'E', 'S', 'Q', true, 3, 5, false, 3, 6]
	},
	{
		map: [
			' TTT#       ',
			'S#TT0   TT  ',
			'    #       ',
			'#####  TTTT ',
			'TTT #ZZZZZZZ',
			'T   #       ',
			'T   #       ',
			'#0# #    #  ',
			'#-# 0       ',
			'#E# #       ',
		],
		special: ['Q', 'U', 'E', 'S', 'T', 3, 'E', 'U', 'Z', 'E', 'S', 'T',
		'E', 'E', 'E', 'E', 'E', 6, 3],
		init: SInit,
		logic: SLogic,
		rem0Logic: SRem0,
		S: 1
	},
	{
		map: [
			'## #### ##  ',
			'#        #  ',
			'#        #  ',
			'# T    T #  ',
			'#   S    1 E',
			'# T    T #  ',
			'#  T  T  #  ',
			'#        #  ',
			'## #### ##  ',
		],
		special: ['R', 'C', 'A', 'E', 'T', 'R'],
		logic: spawnLevelLogic,
		init: spawnLevelInit,
		spawnLevel: 1
	},
	{
		map: [
			'############',
			'#          #',
			'#          #',
			'#          M',
			'S          M',
			'#          M',
			'#          #',
			'#          #',
			'############'
		],
		logic: bossLevelLogic,
		init: bossLevelInit,
		bossLevel: 1
	}
];

function destroyLevel() {
	enemies.forEach(function(e) {
		e.remove();
	});
	enemies = [];
	TO.forEach(clearTimeout);
	TO = [];
}

function loadLevel(lv) {
	$("#covermsg").removeClass("initial");
	overlayEl.empty();
	blockMeMovement = false;
	level = lv;
	var lvi = Levels[lv], spc = 0;
	Lvi = lvi;
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
	lvTemp = {};
	var Bg = $("#bg").empty();
	$("#enemies").empty();
	for (var i = 0; i < 26; ++i) haveTiles[i] = 0;
	for (var i = 0; i < m.length; ++i) {
		var s = m[i];
		var tr = $("<tr>").appendTo(Bg);
		for (var j = 0; j < s.length; ++j) {
			var c = s[j], cl = (c === ' ' || c === '3' ? 'bg' : c === '#' ? 'wall' : c === '^' ? 'spikes' : c);
			var td = $("<td>").addClass("bgtile tile-" + cl).appendTo(tr);
			var pos = tilePos(j, i);
			if (i === 4 && j === 0) lvTemp.blockTd = td;
			if (c === '0') {
				var needed = lvi.special[spc++];
				td.html("<span><span>" + needed + "</span></span>");
				var e = new Enemy('0', pos, function() {}).makeHolder();
				e.ty = i;
				e.tx = j;
				e.td = td;
				e.needed = needed;
				enemies.push(e);
			}
			else if (c === 'M') {
				td.html("<span class='span-M'></span>");
				enemies.push(makeMirrorEnemy(pos));
			}
			else if (c === 'T') {
				var tile = lvi.special[spc++];
				enemies.push(makeTileEnemy(pos, String.charCodeAt(tile)-65));
			}
			else if (c === 'E') {
				enemies.push(new Enemy('end', pos, function() {}).makeHolder());
			}
			else if (c === 'S') {
				mePos = pos;
			}
			else if (c === '3') {
				var vert = lvi.special[spc++];
				var pos1 = lvi.special[spc++];
				var pos2 = lvi.special[spc++];
				enemies.push(makeShieldEnemy(pos, vert, pos1, pos2));
			}
			else if (c === '^') {
				enemies.push(makeSpikesEnemy(pos));
			}
			else if (c === '1' || c === '-') {
				lvTemp.theBeam = {y: i, x: j, td: td};
			}
		}
	}
	if (lvi.init) lvi.init(mePos);
	var me = makeMeEnemy(mePos);
	enemies.push(me);
	Me = me;
	renderTiles();
}

$(function() {
	preload();
	fieldEl = $("#field");
	overlayEl = $("#overlay");
	renderloop();
	$(window).keypress(keyPress).keydown(keyDown).keyup(keyUp);
	//loadLevel(0);
	level = -1;
	playState = 2;
	$("#covermsg").html("<div id='initial-header'>sWord</div>Press enter to begin.").show().addClass("initial");
	setInterval(logic, 20);
});
