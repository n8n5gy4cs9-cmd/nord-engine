// Fade an entity's sprite out and destroy it.
this.tween(this.entity, { alpha: 0 }, { duration: 0.4, onComplete: () => this.entity.destroy() });
