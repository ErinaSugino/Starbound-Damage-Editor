'use-strict'
class Editor {
	static get COMPRESSION_NONE() {return 0;}
	static get COMPRESSION_MEDIUM() {return 1;}
	static get COMPRESSION_FULL() {return 2;}
	
	#_compressionLevel = 0;
	#_eventListeners = {load: [], update: []};
	#_eventLocks = {load: false, update: false};
	
	constructor() {
		this._kind = "";
		this._effects = {};
		
		this.loadClean();
	}
	
	destroy() {
		let i;
		try {
			for(i in this._effects.length) {this._effects[i].destroy();}
		} catch(e) {
			console.error("Couldn't clear Editor!", e);
		}
		this._effects = {};
		this._kind = "";
		
		this.#fireEvent("load");
	}
	
	get compressionLevel() {return this.#_compressionLevel;}
	set compressionLevel(val) {
		val = parseInt(val) || 0;
		if(val == Animator.COMPRESSION_NONE || val == Animator.COMPRESSION_MEDIUM || val == Animator.COMPRESSION_FULL) this.#_compressionLevel = val;
	}
	
	addEventListener(e, f, c = -1) {
		e = String(e);
		c = parseInt(c) || -1;
		if(!this.#_eventListeners[e]) return false;
		if(typeof f != "function") return false;
		
		this.#_eventListeners[e].push({callback: f, count: c});
		return true;
	}
	removeEventListener(e, f) {
		e = String(e);
		if(!this.#_eventListeners[e]) return false;
		if(typeof f != "function") return false;
		
		let index = -1;
		for(let i = 0; i < this.#_eventListeners[e].length; i++) {
			if(this.#_eventListeners[e][i].callback == f) {
				index = i;
				break;
			}
		}
		if(index == -1) return false;
		this.#_eventListeners[e].splice(index, 1);
		return true;
	}
	#fireEvent(e) {
		if(!this.#_eventListeners[e] || this.#_eventLocks[e]) return;
		
		for(let i = 0; i < this.#_eventListeners[e].length; i++) {
			let c = this.#_eventListeners[e][i];
			try {c.callback(); if(c.count != -1) c.count--;}
			catch(err) {console.error("Error executing "+e+" event handler", err)}
		}
		
		this.#_eventListeners[e] = this.#_eventListeners[e].filter((v) => {return v.count != 0;});
	}
	
	loadClean() {
		this._effects.organic = new Effect();
		this._effects.robotic = new Effect();
		this._effects.wooden = new Effect();
		this._effects.stone = new Effect();
		
		this.#fireEvent('load');
	}
	
	load(data) {
		this.#_eventLocks.load = true; //Lock loading event - it would trigger on destruction but we will trigger it when we are done anyway
		this.#_eventLocks.update = true; //Lock updating event - we will trigger it a ton but it will only need to be triggered when done
		this.destroy();
		let errorCount = 0;
		
		if(data.kind) this._kind = String(data.kind);
		data.effects = data.effects || {};
		this._effects.organic = new Effect(data.effects.organic);
		this._effects.robotic = new Effect(data.effects.robotic);
		this._effects.wooden = new Effect(data.effects.wooden);
		this._effects.stone = new Effect(data.effects.stone);
		
		this.#_eventLocks.load = false;
		this.#_eventLocks.update = false;
		this.#fireEvent("load");
		return errorCount;
	}
	
	hasElements() {
		let elems = Object.keys(this._effects).length;
		return elems > 0;
	}
	
	get kind() {return this._kind;}
	set kind(val) {this._kind = String(val);}
	
	output() {
		if(!this.hasElements()) return null;
		
		let output = {kind:this._kind,effects:{}};
		output.effects.organic = this._effects.organic.output();
		output.effects.robotic = this._effects.robotic.output();
		output.effects.wooden = this._effects.wooden.output();
		output.effects.stone = this._effects.stone.output();
		
		return output;
	}
	
	print(override = null, colorize = false) {
		let res = this.output();
		if(res == null) return res;
		let compressionLevel = override == null ? this.#_compressionLevel : (parseInt(override) || 0);
		if(compressionLevel == Editor.COMPRESSION_NONE) res = JSON.stringify(res, null, "\t");
		else if(compressionLevel == Editor.COMPRESSION_MEDIUM) res = JSON.stringify(res, (k,v) => {
			let s = "";
			if(v instanceof Array && v.length > 0 && (typeof v[0] == "number" || typeof v[0] == "string" || typeof v[0] == "boolean")) {
				s = "$[";
				for(let i = 0; i < v.length; i++) {
					s += typeof v[i] == "number" ? v[i] : (typeof v[i] ==  "boolean" ? String(v[i]) : '"'+v[i]+'"');
					s += ',';
				}
				s = s.substring(0, s.length-1);
				s += "]$";
				return s;
			}
			if(typeof v == "object") {
				let k = Object.keys(v);
				if(k.length == 1 && (typeof v[k[0]] == "number" || typeof v[k[0]] == "string" || typeof v[k[0]] == "boolean")) {
					let vv = v[k[0]]
					s = '${"'+k+'": ';
					s += typeof vv == "number" ? vv : (typeof vv == "boolean" ? String(vv) : '"'+vv+'"');
					s += "}$";
					return s;
				}
			}
			return v;
		}, "\t").replace(/"\$(\{|\[)([^\]\}]*?)(\]|\})\$"/g, (m,p1,p2,p3) => {
			let s = p2.replace(/\\\\"/g,'\"').replace(/\\"/g,'"');
			return ""+p1+s+p3;
		});
		else res = JSON.stringify(res);
		
		if(colorize) {
			res = res.replace(/(?:&|\\"|<|>)/g, (match) => {
				switch(match) {
					case '&': return '&amp;'; break;
					case '\"': return '&quot;'; break;
					case '<': return '&lt;'; break;
					case '>': return '&gt;'; break;
					default: return match;
				}
			}).replace(/^(\s*)("[\w-]+": ?)?("[^"]*"|[\w.+-]*)?([[{}\]]*,?)?$/mg, (match, pIndent, pKey, pVal, pEnd) => {
				let key = '<span class=json_key>',
					num = '<span class=json_number>',
					exp = '<span class=json_expression>';
				let r = '<label class="line">' + pIndent || '';
				if (pKey) r += key + pKey.replace(/[: ]/g, '') + '</span>: ';
				if (pVal) {
					if(pVal.match(/^(?:true|false|null)$/i)) r += exp + pVal + '</span>';
					else if(pVal.match(/^[0-9+\-\.,e]+$/)) r += num + pVal + '</span>';
					else r += '<span>' + pVal + '</span>';
				}
				return r + (pEnd || '') + '</label>';
			});
		}
		
		return res;
	}
}