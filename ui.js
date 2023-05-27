'use-strict'
class UI {
	constructor() {
		this._tabs = {};
		
		let allTabs = document.querySelectorAll('.tab[id]');
		for(let i = 0; i < allTabs.length; i++) {
			let elem = allTabs[i];
			let id = elem.id;
			let instance;
			
			if(id == "") continue;
			if(this._tabs[id]) {console.warn("Duplicate ID in UI tabs!", id); continue;}
			switch(id) {
				case 'editor': instance = new EditorTab(elem); break;
				case 'preview': instance = new PreviewTab(elem); break;
				default: continue; break;
			}
			
			this._tabs[id] = instance;
		}
		
		this._boundHandleTabChange = this.handleTabChange.bind(this);
		document.getElementById('navigation').addEventListener('click', this._boundHandleTabChange);
	}
	
	destroy() {
		document.getElementById('navigation').removeEventListener('click', this._boundHandleTabChange);
		
		for(let i in this._tabs) {
			try{this._tabs[i].destroy();}
			catch(e) {console.error("Could not destroy tab!", e);}
		}
		this._tabs = null;
	}
	
	handleTabChange(e) {
		let target = e.target || null;
		if(target == null) return false;
		if(!target.classList.contains('tab_header')) return true;
		
		let forId = target.dataset['for'] || null;
		if(forId == null) return true;
		let tab = document.getElementById(forId);
		if(tab == null || tab.classList.contains('active')) return true;
		
		let activeTabHeaders = document.querySelectorAll('.tab_header.active');
		for(let i = 0; i < activeTabHeaders.length; i++) {activeTabHeaders[i].classList.remove('active');}
		target.classList.add('active');
		
		for(let i in this._tabs) {
			if(i == forId) continue;
			this._tabs[i].onUnload();
		}
		
		if(this._tabs[forId]) {
			try {this._tabs[forId].onLoad();}
			catch(e) {console.error("Error in "+forId+"'s onLoad handler", e);}
		}
	}
}

class UITab {
	constructor(elem) {
		if(new.target === UITab) throw TypeError("Trying to instantiate abstract class UITab");
		
		this._tab = elem;
		this._navbar = elem.children[0];
		this._content = elem.children[1];
		this._nests = [];
		this._active = false;
		
		this._boundHandleNavigation = this.handleNavigation.bind(this);
		this._navbar.addEventListener('click', this._boundHandleNavigation);
	}
	
	destroy() {
		this._navbar.removeEventListener('click', this._boundHandleNavigation);
	}
	
	get tab() {return this._tab;}
	set tab(val) {
		this._tab = val;
		this._navbar = this._tab.children[0];
		this._content = this._tab.children[1];
	}
	
	get navbar() {return this._navbar;}
	get content() {return this._content;}
	
	addNavigationLayer(name, data) {
		this._nests.push({name: name, data: data});
		
		this.buildNavbar();
		this.buildLayeredContent(data);
	}
	removeNavigationLayer(depth = 1) {
		depth = parseInt(depth) || 1;
		this._nests.splice(depth * -1);
		
		let data = (this._nests[Math.max(this._nests.length - 1, 0)] || {}).data || null;
		this.buildNavbar();
		this.buildLayeredContent(data);
	}
	
	buildNavbar() {
		let highest = this._nests.length - 1;
		
		let backButton = document.createElement('div');
		backButton.classList.add('back_button');
		if(highest == -1) backButton.classList.add('invisible');
		backButton.append("↩");
		this._navbar.replaceChildren(backButton);
		
		let navelem = document.createElement('div');
		navelem.classList.add('nav_element');
		navelem.append("Overview");
		navelem.dataset['depth'] = highest;
		this._navbar.append(navelem);
		
		for(let i = 0; i < this._nests.length; i++) {
			let data = this._nests[i];
			let marker = document.createElement('span');
			marker.classList.add('no_select');
			marker.innerText = "—→";
			this._navbar.append(marker);
			navelem = document.createElement('div');
			navelem.classList.add('nav_element');
			navelem.append(String(data.name));
			navelem.dataset['depth'] = (highest - i);
			this._navbar.append(navelem);
		}
		
		navelem.classList.add('current');
	}
	
	handleNavigation(e) {
		let target = e.target;
		if(target == null) return false;
		
		if(target.classList.contains('back_button') && !target.classList.contains('invisible')) this.removeNavigationLayer();
		else if(target.classList.contains('nav_element') && !target.classList.contains('current')) {
			let depth = target.dataset['depth'];
			this.removeNavigationLayer(depth);
		}
		return true;
	}
	
	buildLayeredContent(data) {return;}
	
	onLoad() {if(this._active) return; this._tab.classList.add('active'); this._active = true;}
	onUnload() {if(!this._active) return; this._tab.classList.remove('active'); this._active = false;}
}

class PreviewTab extends UITab {
	#_isClean = true;
	
	constructor(elem) {
		super(elem);
		
		this._editor = editor;
		this._output = this._content.querySelector('pre');
		this._anchor = this._output.parentElement;
		if(this._output.innerHTML != "") this.#_isClean = false;
		
		this._boundUpdatePreview = this.updatePreview.bind(this);
		this._boundResetPreview = this.resetPreview.bind(this);
		
		if(elem.classList.contains('active')) this.onLoad();
	}
	
	destroy() {
		this.resetPreview();
		this._editor = null;
		super.destroy();
	}
	
	onLoad() {
		if(this._active) return;
		super.onLoad();
		
		if(!this._editor) return;
		this.updatePreview();
		
		editor.addEventListener('load', this._boundUpdatePreview);
	}
	onUnload() {
		if(!this._active) return;
		super.onUnload();
		
		editor.removeEventListener('load', this._boundUpdatePreview);
		let parentElem = this._output.parentElement;
		this.resetPreview();
	}
	
	updatePreview() {
		let result = this._editor.print(Editor.COMPRESSION_NONE);
		this.resetPreview();
		if(result == null) {this._output.innerText = "Project is empty."; this.#_isClean = false; return;}
		//this._output.innerHTML = result;
		
		let fragment = document.createDocumentFragment();
		
		// Colorization
		var lines = result.split("\n");
		for(let i = 0; i < lines.length; i++) {
			let line = lines[i];
			let matches = line.match(/^(\s*)("[\w-]+": ?)?("[^"]*"|[\w.+-]*)?([[{}\]]*,?)?$/m);
			let result = document.createElement('label');
			result.classList.add('line');
			let sub;
			
			if(matches[1]) result.append(matches[1]);
			if(matches[2]) {
				sub = document.createElement('span');
				sub.classList.add('json_key');
				sub.append(matches[2].replace(/[: ]/g, ''));
				result.append(sub);
				result.append(": ");
			}
			if(matches[3]) {
				sub = document.createElement('span');
				if(matches[3].match(/^(?:true|false|null)$/i)) sub.classList.add('json_expression');
				else if(matches[3].match(/^[0-9+\-\.,e]+$/)) sub.classList.add('json_number');
				sub.append(matches[3]);
				result.append(sub);
			}
			if(matches[4]) result.append(matches[4]);
			fragment.append(result);
		}
		
		this._output.append(fragment);
		
		let highestIndex = String(this._output.children.length).length;
		let indentWidth = ''+(highestIndex*8)+'px';
		this._output.style.setProperty('--indent_width', indentWidth);
		
		this.#_isClean = false;
	}
	
	resetPreview() {
		if(this.#_isClean) return;
		this._output.remove();
		this._output = document.createElement('pre');
		this._anchor.appendChild(this._output);
	}
}

class EditorTab extends UITab {
	constructor(elem) {
		super(elem);
		this._editor = editor;
		
		this._boundHandleAction = this.handleAction.bind(this);
		this._boundHandleInput = this.handleInput.bind(this);
		this._boundHandleChange = this.handleChange.bind(this);
		this._content.addEventListener('click', this._boundHandleAction);
		this._content.addEventListener('change', this._boundHandleChange);
		
		this._boundBuildNavbar = this.buildNavbar.bind(this);
		this._boundBuildLayeredContent = this.buildLayeredContent.bind(this);
		
		if(elem.classList.contains('active')) this.onLoad();
	}
	
	destroy() {
		this._content.removeEventListener('click', this._boundHandleAction);
		this._content.removeEventListener('change', this._boundHandleChange);
		this._content.innerHTML = '';
		this._editor.removeEventListener('load', this._boundBuildNavbar);
		this._editor.removeEventListener('load', this._boundBuildLayeredContent);
		this._editor = null;
		
		super.destroy();
	}
	
	onLoad() {
		super.onLoad();
		this._editor.addEventListener('load', this._boundBuildNavbar);
		this._editor.addEventListener('load', this._boundBuildLayeredContent);
		this.buildNavbar();
		this.buildLayeredContent();
	}
	
	onUnload() {
		this._content.innerHTML = '';
		this._nests = [];
		this._editor.removeEventListener('load', this._boundBuildNavbar);
		this._editor.removeEventListener('load', this._boundBuildLayeredContent);
		super.onUnload();
	}
	
	handleAction(e) {
		let target = e.target;
		if(target == null) return false;
		if(target.tagName != "BUTTON") return false;
		
		let action = target.dataset['action'];
		if(action == "addSound") this.addSound();
		else if(action == "deleteSound") this.removeSound(target);
		else if(action == "addParticle") this.doAddParticle();
		else if(action == "editParticle") this.editParticle(target);
		else if(action == "deleteParticle") this.removeParticle(target);
		return true;
	}
	
	handleInput(e) {
		let target = e.target;
		if(target == null) return false;
		if(target.tagName != "INPUT" || target.type == "checkbox") return false;
		
		let efName = this._content.children[0].dataset['efName'];
		let cName = this._content.children[0].dataset['cName'];
		let index = this._content.children[0].dataset['pIndex'];
		
		let id = target.id, value = target.value;
		if(id == "kind") {this._editor.kind = value; return true;}
		
		let particle = this._editor._effects[efName]._categories[cName]._particles[index];
		
		switch(id) {
			case 'animation': particle.animation = value; break;
			case 'size': particle.size = value; break;
			case 'angularvelocity': particle.angularVelocity = value; break;
			case 'color1': case 'color2': case 'color3': case 'color4':
				particle.color = [
					document.getElementById('color1').value,
					document.getElementById('color2').value,
					document.getElementById('color3').value,
					document.getElementById('color4').value
				];
				break;
			case 'fade': particle.fade = value; break;
			case 'destructiontime': particle.destructionTime = value; break;
			case 'destructionaction': particle.destructionAction = value; break;
			case 'position1': case 'position2':
				particle.position = [
					document.getElementById('position1').value,
					document.getElementById('position2').value
				];
				break;
			case 'initialvelocity1': case 'initialvelocity2':
				particle.initialVelocity = [
					document.getElementById('initialvelocity1').value,
					document.getElementById('initialvelocity2').value
				];
				break;
			case 'finalvelocity1': case 'finalvelocity2':
				particle.finalVelocity = [
					document.getElementById('finalvelocity1').value,
					document.getElementById('finalvelocity2').value
				];
				break;
			case 'approach1': case 'approach2':
				particle.approach = [
					document.getElementById('approach1').value,
					document.getElementById('approach2').value
				];
				break;
			case 'layer': particle.layer = value; break;
			case 'timetolive': particle.timeToLive = value; break;
		}
	}
	
	handleChange(e) {
		let target = e.target;
		if(target == null) return false;
		if(target.tagName != "SELECT" && target.id != "flippable") return false;
		
		let efName = this._content.children[0].dataset['efName'];
		let cName = this._content.children[0].dataset['cName'];
		let index = this._content.children[0].dataset['pIndex'];
		
		let id = target.id, value = target.value, checked = target.checked || false;
		switch(id) {
			case 'type':
				this._editor._effects[efName]._categories[cName]._particles[index].type = value;
				if(value == "animated") document.getElementById('animation_row').classList.remove('hidden');
				else document.getElementById('animation_row').classList.add('hidden');
				break;
			case 'flippable':
				this._editor._effects[efName]._categories[cName]._particles[index].flippable = checked;
				break;
		}
	}
	
	setEnabled(e) {
		let target = e.target;
		if(target == null) return false;
		if(target.tagName != "INPUT" || !target.classList.contains('checkbox')) return false;
		
		let efName = this._content.children[0].dataset['efName'];
		let cName = this._content.children[0].dataset['cName'];
		let index = this._content.children[0].dataset['pIndex'];
		
		let id = target.id, checked = target.checked, t = target.dataset['target'];
		this._editor._effects[efName]._categories[cName]._particles[index].setSaveParameters(t, checked);
	}
	
	buildLayeredContent(data = null) {
		this._content.innerHTML = '';
		
		if(data == null) this.loadMenu();
		else if(data.layer == 1) this.loadEffect(data.id);
		else if(data.layer == 2) this.loadCategory(data.id, data.refId);
		else if(data.layer == 3) this.loadParticle(data.id, data.refId, data.particleId);
		else this.loadMenu();
	}
	
	loadMenu() {
		let template = document.getElementById('fragment_menu').content;
		let clone = document.importNode(template, true);
		
		let elem = clone.getElementById('kind');
		elem.value = this._editor.kind;
		elem.addEventListener('blur', this._boundHandleInput);
		
		let clickables = clone.querySelectorAll('div.clickable');
		for(let i = 0; i < clickables.length; i++) {clickables[i].addEventListener('click', (el)=>{this.addNavigationLayer("Type: "+el.currentTarget.children[0].innerText, {layer: 1, id: el.currentTarget.dataset['effect']})});}
		
		this._content.appendChild(clone);
	}
	loadEffect(efName) {
		let template = document.getElementById('fragment_effect').content;
		let clone = document.importNode(template, true);
		
		clone.getElementById('container').dataset['effect'] = efName;
		
		let clickables = clone.querySelectorAll('div.clickable');
		for(let i = 0; i < clickables.length; i++) {clickables[i].addEventListener('click', (el)=>{this.addNavigationLayer("Effect: "+el.currentTarget.children[0].innerText, {layer: 2, id: el.currentTarget.parentElement.dataset['effect'], refId: el.currentTarget.dataset['category']})});}
		
		this._content.appendChild(clone);
	}
	loadCategory(efName, cName) {
		let template = document.getElementById('fragment_category').content;
		let clone = document.importNode(template, true);
		let category = this._editor._effects[efName]._categories[cName];
		
		clone.children[0].dataset['efName'] = efName;
		clone.children[0].dataset['cName'] = cName;
		
		this._content.appendChild(clone);
		
		for(let i = 0; i < category._sounds.length; i++) {
			this.doAddSound(category._sounds[i], false);
		}
		
		for(let i = 0; i < category._particles.length; i++) {
			this.doAddParticle(i);
		}
	}
	loadParticle(efName, cName, id) {
		let template = document.getElementById('fragment_particle').content;
		let clone = document.importNode(template, true);
		let category = this._editor._effects[efName]._categories[cName];
		let particle = category._particles[id];
		
		clone.children[0].dataset['efName'] = efName;
		clone.children[0].dataset['cName'] = cName;
		clone.children[0].dataset['pIndex'] = id;
		
		clone.getElementById('type').value = particle.type;
		clone.getElementById('animation').value = particle.animation;
		if(particle.type == "animated") clone.getElementById('animation_row').classList.remove('hidden');
		clone.getElementById('size').value = particle.size;
		clone.getElementById('angularvelocity').value = particle.angularVelocity;
		let color = particle.color;
		clone.getElementById('color1').value = color[0];
		clone.getElementById('color2').value = color[1];
		clone.getElementById('color3').value = color[2];
		clone.getElementById('color4').value = color[3];
		clone.getElementById('fade').value = particle.fade;
		clone.getElementById('destructiontime').value = particle.destructionTime;
		clone.getElementById('destructionaction').value = particle.destructionAction;
		let pos = particle.position;
		clone.getElementById('position1').value = pos[0];
		clone.getElementById('position2').value = pos[1];
		let iVel = particle.initialVelocity;
		clone.getElementById('initialvelocity1').value = iVel[0];
		clone.getElementById('initialvelocity2').value = iVel[1];
		let fVel = particle.finalVelocity;
		clone.getElementById('finalvelocity1').value = fVel[0];
		clone.getElementById('finalvelocity2').value = fVel[1];
		let app = particle.approach;
		clone.getElementById('approach1').value = app[0];
		clone.getElementById('approach2').value = app[1];
		clone.getElementById('layer').value = particle.layer;
		clone.getElementById('timetolive').value = particle.timeToLive;
		clone.getElementById('flippable').checked = particle.flippable;
		
		let enabled = particle.saveParameters;
		clone.getElementById('size_enabled').checked = enabled['size'];
		clone.getElementById('angularvelocity_enabled').checked = enabled['angularVelocity'];
		clone.getElementById('color_enabled').checked = enabled['color'];
		clone.getElementById('fade_enabled').checked = enabled['fade'];
		clone.getElementById('destructiontime_enabled').checked = enabled['destructionTime'];
		clone.getElementById('destructionaction_enabled').checked = enabled['destructionAction'];
		clone.getElementById('position_enabled').checked = enabled['position'];
		clone.getElementById('initialvelocity_enabled').checked = enabled['initialVelocity'];
		clone.getElementById('finalvelocity_enabled').checked = enabled['finalVelocity'];
		clone.getElementById('approach_enabled').checked = enabled['approach'];
		clone.getElementById('layer_enabled').checked = enabled['layer'];
		clone.getElementById('timetolive_enabled').checked = enabled['timeToLive'];
		
		let inputs = clone.querySelectorAll('input');
		for(let i = 0; i < inputs.length; i++) {
			inputs[i].addEventListener('blur', this._boundHandleInput);
		}
		let selects = clone.querySelectorAll('select, #flippable');
		for(let i = 0; i < selects.length; i++) {
			selects[i].addEventListener('change', this._boundHandleChange);
		}
		let checks = clone.querySelectorAll('input.checkbox:not(#flippable)');
		for(let i = 0; i < checks.length; i++) {
			checks[i].addEventListener('change', this.setEnabled.bind(this));
		}
		
		this._content.appendChild(clone);
	}
	
	addSound() {
		Modal.confirm(
			"Add Sound",
			"Enter path to the new sound source.<br>Comma separate entries in a pool.<br><br><input class='textfield large' type='text' id='sound' placeholder='Path/list' />",
			(function() {
				let text = document.getElementById('sound').value;
				if(text != "") {
					this.doAddSound(text);
					return true;
				}
			}).bind(this),
			null,
			"Add",
			"Abort",
			"small",
			false
		);
	}
	doAddSound(name, apply=true) {
		let efName = this._content.children[0].dataset['efName'];
		let cName = this._content.children[0].dataset['cName'];
		let category = this._editor._effects[efName]._categories[cName];
		if(typeof name == "string" && name.indexOf(',') != -1) {
			name = name.split(',');
			for(let i = 0; i < name.length; i++) {name[i] = name[i].trim();}
		}
		if(apply) category.addSound(name);
		
		let newSound = document.createElement('div');
		newSound.classList.add('sound');
		newSound.dataset['id'] = document.getElementById('sounds').children.length;
		
		let cell1 = document.createElement('div');
		cell1.classList.add('cell', 'grow', 'right');
		cell1.innerHTML = typeof name == "string" ? name : '<b>[</b> '+name.join(', ')+' <b>]</b>';
		newSound.append(cell1);
		
		let cell2 = document.createElement('div');
		cell2.classList.add('cell', 'controls', 'hover');
		let button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '-';
		button.title = "Remove Sound";
		button.dataset['action'] = "deleteSound";
		cell2.append(button);
		newSound.append(cell2);
		
		document.getElementById('sounds').append(newSound);
	}
	
	removeSound(elem) {
		let index = parseInt(elem.parentElement.parentElement.dataset['id']) ||  0; // Button -> cell -> sound (with data)
		
		Modal.confirm(
			"Delete Sound",
			"Are you sure you want to delete sound #"+(index+1)+"?",
			(function() {this.doRemoveSound(index); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"small",
			true
		);
	}
	doRemoveSound(index) {
		let efName = this._content.children[0].dataset['efName'];
		let cName = this._content.children[0].dataset['cName'];
		let category = this._editor._effects[efName]._categories[cName];
		
		category.removeSound(index);
		let container = document.getElementById('sounds');
		container.children[index].remove();
		
		for(let i = 0; i < container.children.length; i++) {container.children[i].dataset['id'] = i;}
	}
	
	addParticle() {
		
	}
	doAddParticle(index = -1) {
		let efName = this._content.children[0].dataset['efName'];
		let cName = this._content.children[0].dataset['cName'];
		let category = this._editor._effects[efName]._categories[cName];
		if(index == -1) {category.addParticle(); index = category._particles.length-1;}
		let particle = category._particles[index];
		
		let newParticle = document.createElement('div');
		newParticle.classList.add('particle');
		newParticle.dataset['id'] = document.getElementById('particles').children.length;
		
		let type = particle.type;
		let cell1 = document.createElement('div');
		cell1.classList.add('cell', 'grow', 'right');
		cell1.innerText = "Type: "+type;
		if(type == "animated") cell1.innerText += "\n"+particle.animation;
		newParticle.append(cell1);
		
		let cell2 = document.createElement('div');
		cell2.classList.add('cell', 'controls', 'hover');
		let button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '✎';
		button.title = "Edit Particle";
		button.dataset['action'] = "editParticle";
		cell2.append(button);
		button = document.createElement('button');
		button.classList.add('modern', 'tiny');
		button.innerText = '-';
		button.title = "Remove Particle";
		button.dataset['action'] = "deleteParticle";
		cell2.append(button);
		newParticle.append(cell2);
		
		document.getElementById('particles').append(newParticle);
	}
	
	editParticle(elem) {
		let efName = this._content.children[0].dataset['efName'];
		let cName = this._content.children[0].dataset['cName'];
		let index = parseInt(elem.parentElement.parentElement.dataset['id']) ||  0; // Button -> cell -> particle (with data)
		
		this.addNavigationLayer("Particle #"+(index+1), {layer: 3, id: efName, refId: cName, particleId: index});
	}
	
	removeParticle(elem) {
		let index = parseInt(elem.parentElement.parentElement.dataset['id']) ||  0; // Button -> cell -> particle (with data)
		
		Modal.confirm(
			"Delete Particle",
			"Are you sure you want to delete particle #"+(index+1)+"?",
			(function() {this.doRemoveParticle(index); return true;}).bind(this),
			null,
			"Delete",
			"Abort",
			"small",
			true
		);
	}
	doRemoveParticle(index) {
		let efName = this._content.children[0].dataset['efName'];
		let cName = this._content.children[0].dataset['cName'];
		let category = this._editor._effects[efName]._categories[cName];
		
		category.removeParticle(index);
		let container = document.getElementById('particles');
		container.children[index].remove();
		
		for(let i = 0; i < container.children.length; i++) {container.children[i].dataset['id'] = i;}
	}
}