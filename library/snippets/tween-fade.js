// @nord {"id": "fx.tween-fade", "title": "Tween fade-out", "category": "fx", "tier": ["2d", "3d"], "tags": ["tween", "alpha"], "description": "Fade the entity out then destroy it. Paste into a script method.", "requires": []}
// Fade an entity's sprite out and destroy it.
this.tween(this.entity, { alpha: 0 }, { duration: 0.4, onComplete: () => this.entity.destroy() });
