
W = 500;
H = 400;

tiles = [];
chmap = [];
fieldEl = null;
overlayEl = null;
playState = -1; // -1 = none, 0 = playing, 1 = dead, 2 = waiting on next level
level = -1;
myFacing = [-1, 0]; // [0] = y, [1] = x
myDirection = [0, 0]; // [0] = y, [1] = x
myPosition = null;
paused = false;
signAreas = null;

for (var i = 0; i < 26; ++i) {
	tiles.push(0);
	chmap.push(String.fromCharCode(65 + i));
}

function within(area, pos) {
	return (area.x >= pos.x && pos.x < area.x + area.w) &&
		(area.y >= pos.y && pos.y < area.y + area.h);
}

function Enemy(type, pos, move) {
	this.pos = pos;
	this.move = move;
	this.el = $("<div>").addClass("enemy enemy-" + type);
	if (type === 'small')
		this.hitbox = {x: 10, y: 10, w: 10, h: 10};
}

function sq(x) { return x*x; }

function makeCycleMove(ar, speed) {
	var ind = 0;
	return function() {
		if (!ar.length) return;
		var cur = this.pos, next = ar[ind];
		var d = sq(cur.x-next.x) + sq(cur.y-next.y);
		var sp2 = sq(speed);
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
	var html = "";
	var vis = [];
	tiles.forEach(function(n, i) {
		if (!n) return;
		var p = tiles[i];
		if (p > 1e8) p = "&infty;";
		vis.push("<div><span class='points'>" + pointsmap[i] + "</span>" + chmap[i] + "</div> x" + p);
	});
	var Each = 5;
	for (var r = 0; r < vis.length/Each; ++r) {
		html += "<tr>";
		for (var a = 0; a < Each; ++a) {
			var i = r*Each + a;
			if (i >= vis.length) break;
			html += "<td>" + vis[i] + "</td>";
		}
		html += "</tr>";
	}
	$("#ptable").html(html);
}

function render() {
	// TODO move messages etc.
}

function renderloop() {
	render();
	window.mozRequestAnimationFrame = renderloop;
}

function shootTile(ch) {
	--tiles[ch];
	// TODO
	renderTiles();
}

function keyPress(e) {
	var k = String.fromCharCode(e.charCode);
	if (playState === 0) {
		if (paused) {
			if (k === 'k') {
				paused = false;
				$("#covermsg").hide();
			}
		}
		else {
			if (e.charCode === 13) {
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
			else if (e.charCode >= 65 && e.charCode < 65 + 26) {
				var ch = e.charCode - 65;
				if (tiles[ch] > 0)
					shootTile(ch);
			}
		}
	}
	else if (playState === 1) {
		if (k == 'r') {
			// TODO restart
		}
	}
	else if (playState === 2) {
		if (k === ' ') {
			loadLevel(level+1);
		}
	}
}

function keyDown(e) {
	if (playState === 0 && !paused) {
		// TODO arrows
		var setDir = false;
		if (e.which === 15) {
			myDirection[0] = -1;
			setDir = !myDirection[1];
		}
		else if (e.which === 15) {
			myDirection[0] = 1;
			setDir = !myDirection[1];
		}
		else if (e.which === 15) {
			myDirection[1] = -1;
			setDir = !myDirection[0];
		}
		else if (e.which === 15) {
			myDirection[1] = 1;
			setDir = !myDirection[0];
		}
		if (setDir) myFacing = myDirection.slice();
		alert(e.which);
	}
}

function logic() {
	if (playState !== 0 || paused) return;
	// TODO
	// Blah blah moving, collisions, letters hitting enemies/walls,
	// enemies shooting sometimes, 
}


Levels = [
	{
		map: [
			'   T#     ',
			'   T# TTT ',
			' S T0 T T ',
			'   T#     ',
			'   T###0##',
			'######    ',
			'     # TT ',
			'  E  # TT ',
			'     #    ',
			'     #    '
		]
	}
];

function loadLevel(lv) {
	level = lv;
	var lvi = Levels[lv];
	paused = false;
	playState = 0;
	signAreas = lvi.signAreas || [];
	$("#covermsg").hide();
	var m = lvi.map;

	// TODO
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
