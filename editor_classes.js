'use-strict'
class IDManager {
	static #_id = 0;
	static #_registeredIDs = {};
	
	static getId(ref) {
		let id = IDManager.#_id++;
		IDManager.#_registeredIDs[id] = ref;
		return id;
	}
	static freeId(id) {
		id = parseInt(id) || 0;
		delete IDManager.#_registeredIDs[id];
		if(Object.keys(IDManager.#_registeredIDs).length <= 0) IDManager.resetIDs();
	}
	static resetIDs() {IDManager.#_id = 0; console.log("No more IDs registered - resetting index.");}
	
	static getById(id) {id = parseInt(id) || 0; return IDManager.#_registeredIDs[id];}
	
	static getStatistic() {return "Currently registered: "+Object.keys(IDManager.#_registeredIDs).length+" IDs. Highest index: "+IDManager.#_id;}
}

/**
 * Class representing an effect type
 */
class Effect {
	#_id = null;
	
	constructor(parameters = {}) {
		this.#_id = IDManager.getId(this);
		
		this._categories = {};
		
		this._categories.hit = new Category(parameters.hit);
		this._categories.stronghit = new Category(parameters.stronghit);
		this._categories.kill = new Category(parameters.kill);
	}
	
	destruct() {
		try {
			this._categories.hit.destroy();
			this._categories.stronghit.destroy();
			this._categories.kill.destroy();
		} catch(e) {console.warn("Could not destroy effect categories", e);}
		this._states = null;
		
		IDManager.freeId(this.#_id);
	}
	
	get categories() {return Object.assign({}, this._categories);}
	
	output() {
		return {
			hit: this._categories.hit.output(),
			stronghit: this._categories.stronghit.output(),
			kill: this._categories.kill.output()
		};
	}
}

/**
 * Class representing an effect category
 */
class Category {
	#_id = null;
	
	constructor(parameters = {}) {
		this.#_id = IDManager.getId(this);
		
		this._sounds = [];
		this._particles = [];
		
		this.setup(parameters);
	}
	
	destroy() {
		try {
			for(i = 0; i < this._particles.length; i++) {this._particles[i].destroy();}
		} catch(e) {console.warn("Could not destroy effect particles", e);}
		this._states = null;
		
		IDManager.freeId(this.#_id);
	}
	
	setup(data = {}) {
		if(data.sounds && Array.isArray(data.sounds)) {
			for(let i = 0; i < data.sounds.length; i++) {this.addSound(data.sounds[i]);}
		}
		if(data.particles && Array.isArray(data.particles) && Array.isArray(data.particles[0])) {
			for(let i = 0; i < data.particles[0].length; i++) {this.addParticle(data.particles[0][i]);}
		}
	}
	
	get sounds() {return [...this._sounds];}
	addSound(val) {this._sounds.push(Array.isArray(val) ? val : String(val));}
	removeSound(id) {
		id = parseInt(id) || 0;
		if(id < 0 || id >= this._sounds.length) return false;
		this._sounds.splice(id, 1);
		return true;
	}
	
	get particles() {return Object.assign({}, this._particles);}
	addParticle(parameters = {}) {this._particles.push(new Particle(parameters));}
	removeParticle(id) {
		id = parseInt(id) || 0;
		if(!this._particles[id]) return false;
		let x = this._particles.splice(id, 1);
		try{x[0].destroy();}catch(e){console.warn("Could not destroy particle", e);}
		return true;
	}
	
	output() {
		let ret = {
			sounds: this._sounds,
			particles: [[]]
		};
		for(let i = 0; i < this._particles.length; i++) {ret.particles[0].push(this._particles[i].output());}
		return ret;
	}
}

/**
 * Class representing a complex particle
 */
class Particle {
	#_id = null;
	
	static #_allowedVariance = {initialVelocity: true, timeToLive: false, size: false};
	
	constructor(parameters = {}) {
		this.#_id = IDManager.getId(this);
		
		this._type = "ember";
		this._animation = "";
		this._size = 1.0;
		this._angularVelocity = 0;
		this._color = [0,0,0,0];
		this._fade = 1.0;
		this._destructionTime = 0;
		this._destructionAction = "shrink";
		this._position = [0,0];
		this._initialVelocity = [0,0];
		this._finalVelocity = [0,0];
		this._approach = [0,0];
		this._layer = "front";
		this._timeToLive = 0;
		this._flippable = false;
		
		this._variance = {};
		this._saveParameters = {size:false,angularVelocity:false,color:false,fade:false,destructionTime:false,destructionAction:false,position:false,initialVelocity:false,finalVelocity:false,approach:false,layer:false,timeToLive:false};
		
		this.setup(parameters);
	}
	
	destroy() {
		// Nothing to destroy, only arbitrary data
		IDManager.freeId(this.#_id);
	}
	
	setup(data = {}) {
		if(typeof data != 'object' || Object.keys(data).length == 0) return;
		
		if(data.type) this._type = String(data.type);
		if(this._type == "animated" && data.animation) this._animation = String(data.animation);
		if(typeof data.size != "undefined") {this._size = parseFloat(data.size) || 1.0; this._saveParameters.size = true;}
		if(typeof data.angularVelocity != "undefined") {this._angularVelocity = parseFloat(data.angularVelocity) || 0; this._saveParameters.angularVelocity = true;}
		if(data.color && Array.isArray(data.color)) {
			this._color = [parseInt(data.color[0]) || 0, parseInt(data.color[1]) || 0, parseInt(data.color[2]) || 0, parseInt(data.color[3]) || 0];
			this._saveParameters.color = true;
		}
		if(typeof data.fade != "undefined") {this._fade = parseFloat(data.fade) || 1.0; this._saveParameters.fade = true;}
		if(data.destructionTime) {this._destructionTime = parseFloat(data.destructionTime) || 0; this._saveParameters.destructionTime = true;}
		if(data.destructionAction) {this._destructionAction = String(data.destructionAction); this._saveParameters.destructionAction = true;}
		if(data.position && Array.isArray(data.position)) {
			this._position = [parseFloat(data.position[0]) || 0, parseFloat(data.position[1]) || 0];
			this._saveParameters.position = true;
		}
		if(data.initialVelocity && Array.isArray(data.initialVelocity)) {
			this._initialVelocity = [parseFloat(data.initialVelocity[0]) || 0, parseFloat(data.initialVelocity[1]) || 0];
			this._saveParameters.initialVelocity = true;
		}
		if(data.finalVelocity && Array.isArray(data.finalVelocity)) {
			this._finalVelocity = [parseFloat(data.finalVelocity[0]) || 0, parseFloat(data.finalVelocity[1]) || 0];
			this._saveParameters.finalVelocity = true;
		}
		if(data.approach && Array.isArray(data.approach)) {
			this._approach = [parseFloat(data.approach[0]) || 0, parseFloat(data.approach[1]) || 0];
			this._saveParameters.approach = true;
		}
		if(data.layer) {this._layer = String(data.layer); this._saveParameters.layer = true;}
		if(typeof data.timeToLive != "undefined") {this._timeToLive = parseFloat(data.timeToLive) || 0; this._saveParameters.timeToLive = true;}
		if(data.flippable) this._flippable = true;
		
		if(data.variance && typeof data.variance == "object" && !Array.isArray(data.variance)) {
			for(let i in data.variance) {
				if(Object.hasOwn(Particle.#_allowedVariance, i)) {
					let val = data.variance[i];
					if(Particle.#_allowedVariance[i] && Array.isArray(val)) this._variance[i] = [parseFloat(val[0]) || 0, parseFloat(val[1]) || 0];
					else this._variance[i] = parseFloat(val) || 0;
				}
			}
		}
	}
	
	get id() {return this.#_id;}
	
	get type() {return this._type;}
	set type(val) {this._type = String(val); if(this._type != "animated") this._animation = "";}
	
	get animation() {return this._animation;}
	set animation(val) {if(this._type == "animated") this._animation = String(val);}
	
	get size() {return this._size;}
	set size(val) {this._size = parseFloat(val) || 1.0;}
	
	get angularVelocity() {return this._angularVelocity;}
	set angularVelocity(val) {this._angularVelocity = parseFloat(val) || 0;}
	
	get color() {return [...this._color];}
	set color(val) {if(Array.isArray(val)) this._color = [parseInt(val[0]) || 0, parseInt(val[1]) || 0, parseInt(val[2]) || 0, parseInt(val[3]) || 0];}
	
	get fade() {return this._fade;}
	set fade(val) {this._fade = Math.min(1, Math.max(0, parseFloat(val) || 0));}
	
	get destructionTime() {return this._destructionTime;}
	set destructionTime(val) {this._destructionTime = parseFloat(val) || 0;}
	
	get destructionAction() {return this._destructionAction;}
	set destructionAction(val) {this._destructionAction = String(val);}
	
	get position() {return [...this._position];}
	set position(val) {if(Array.isArray(val)) this._position = [parseFloat(val[0]) || 0, parseFloat(val[1]) || 0];}
	
	get initialVelocity() {return [...this._initialVelocity];}
	set initialVelocity(val) {if(Array.isArray(val)) this._initialVelocity = [parseFloat(val[0]) || 0, parseFloat(val[1]) || 0];}
	
	get finalVelocity() {return [...this._finalVelocity];}
	set finalVelocity(val) {if(Array.isArray(val)) this._finalVelocity = [parseFloat(val[0]) || 0, parseFloat(val[1]) || 0];}
	
	get approach() {return [...this._approach];}
	set approach(val) {if(Array.isArray(val)) this._approach = [parseFloat(val[0]) || 0, parseFloat(val[1]) || 0];}
	
	get layer() {return this._layer;}
	set layer(val) {this._layer = String(val);}
	
	get timeToLive() {return this._timeToLive;}
	set timeToLive(val) {this._timeToLive = parseFloat(val) || 0;}
	
	get flippable() {return this._flippable;}
	set flippable(val) {this._flippable = Boolean(val);}
	
	static allowedVariance() {return Object.assign({}, Particle.#_allowedVariance);}
	get variance() {return Object.assign({}, this._variance);}
	setVariance(name, val) {
		let allowed = Object.keys(Particle.#_allowedVariance);
		let i = allowed.indexOf(name);
		if(i < 0) return false;
		
		let isRange = Particle.#_allowedVariance[allowed[i]];
		if(isRange) {
			if(!Array.isArray(val)) return false;
			val = [parseFloat(val[0])||0, parseFloat(val[1])||0];
		} else val = parseFloat(val) || (name == "size" ? 1 : 0);
		
		this._variance[name] = val;
		return true;
	}
	removeVariance(name) {return delete this._variance[name];}
	
	get saveParameters() {return Object.assign({}, this._saveParameters);}
	setSaveParameters(id, val) {
		if(!Object.hasOwn(this._saveParameters, id)) return;
		this._saveParameters[id] = !!val;
	}
	
	output() {
		let particle = {
			type: this._type,
		};
		
		if(this._type == "animated") particle.animation = this._animation;
		if(this._saveParameters.size) particle.size = this._size;
		if(this._saveParameters.angularVelocity) particle.angularVelocity = this._angularVelocity;
		if(this._saveParameters.color) particle.color = this._color;
		if(this._saveParameters.fade) particle.fade = this._fade;
		if(this._saveParameters.destructionTime) particle.destructionTime = this._destructionTime;
		if(this._saveParameters.destructionAction) particle.destructionAction = this._destructionAction;
		if(this._saveParameters.position) particle.position = this._position;
		if(this._saveParameters.initialVelocity) particle.initialVelocity = this._initialVelocity;
		if(this._saveParameters.finalVelocity) particle.finalVelocity = this._finalVelocity;
		if(this._saveParameters.approach) particle.approach = this._approach;
		if(this._saveParameters.layer) particle.layer = this._layer;
		if(this._saveParameters.timeToLive) particle.timeToLive = this._timeToLive;
		if(this._flippable) particle.flippable = true;
		
		if(Object.keys(this._variance).length > 0) particle.variance = this._variance;
		
		return particle;
	}
}