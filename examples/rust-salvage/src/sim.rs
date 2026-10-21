// Pure rules: no renderer, browser, file system or frame clock required.
#[derive(Clone, Copy, Debug)]
pub struct Body {
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
}
#[derive(Debug)]
pub struct Run {
    pub ship: Body,
    pub rocks: Vec<Body>,
    pub core: (f32, f32),
    pub score: u32,
    pub lives: u32,
    pub remaining: f32,
    pub dash: f32,
    pub shield: f32,
    pub won: bool,
    pub over: bool,
    pub paused: bool,
}
impl Run {
    pub fn new() -> Self {
        Self {
            ship: Body {
                x: 400.,
                y: 300.,
                vx: 0.,
                vy: 0.,
            },
            rocks: (0..6)
                .map(|i| Body {
                    x: 80. + i as f32 * 110.,
                    y: 80.,
                    vx: 35. + i as f32 * 8.,
                    vy: 45.,
                })
                .collect(),
            core: (520., 300.),
            score: 0,
            lives: 3,
            remaining: 60.,
            dash: 0.,
            shield: 1.,
            won: false,
            over: false,
            paused: false,
        }
    }
    pub fn tick(&mut self, dt: f32, direction: (f32, f32), dash: bool) {
        if self.over || self.paused {
            return;
        }
        let dt = dt.clamp(0., 0.05);
        self.remaining = (self.remaining - dt).max(0.);
        self.dash = (self.dash - dt).max(0.);
        self.shield = (self.shield - dt).max(0.);
        let mut speed = 190.;
        if dash && self.dash == 0. {
            self.dash = 2.;
            self.shield = 0.25;
        }
        if self.dash > 1.75 {
            speed = 540.;
        }
        let length = direction.0.hypot(direction.1).max(1.);
        self.ship.x = (self.ship.x + direction.0 / length * speed * dt).clamp(18., 782.);
        self.ship.y = (self.ship.y + direction.1 / length * speed * dt).clamp(55., 582.);
        for rock in &mut self.rocks {
            rock.x += rock.vx * dt;
            rock.y += rock.vy * dt;
            if rock.x < 15. || rock.x > 785. {
                rock.vx = -rock.vx;
                rock.x = rock.x.clamp(15., 785.);
            }
            if rock.y < 55. || rock.y > 585. {
                rock.vy = -rock.vy;
                rock.y = rock.y.clamp(55., 585.);
            }
        }
        if self.shield == 0.
            && self
                .rocks
                .iter()
                .any(|r| (r.x - self.ship.x).hypot(r.y - self.ship.y) < 29.)
        {
            self.lives -= 1;
            self.shield = 1.5;
            self.ship.x = 400.;
            self.ship.y = 300.;
            if self.lives == 0 {
                self.over = true;
                return;
            }
        }
        if (self.core.0 - self.ship.x).hypot(self.core.1 - self.ship.y) < 26. {
            self.score += 1;
            self.remaining += 2.;
            self.core = (
                80. + (self.score * 137 % 640) as f32,
                90. + (self.score * 91 % 450) as f32,
            );
            if self.score == 10 {
                self.won = true;
                self.over = true;
            }
        }
        if self.remaining == 0. {
            self.over = true;
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn diagonal_speed_is_normalized() {
        let mut a = Run::new();
        let mut b = Run::new();
        a.tick(0.01, (1., 0.), false);
        b.tick(0.01, (1., 1.), false);
        assert!(
            ((a.ship.x - 400.).hypot(a.ship.y - 300.) - (b.ship.x - 400.).hypot(b.ship.y - 300.))
                .abs()
                < 0.001
        );
    }
    #[test]
    fn pause_and_loss_freeze_rules() {
        let mut g = Run::new();
        g.paused = true;
        g.tick(0.05, (1., 0.), true);
        assert_eq!(g.remaining, 60.);
        g.paused = false;
        g.remaining = 0.001;
        g.tick(0.01, (0., 0.), false);
        assert!(g.over && !g.won);
    }
    #[test]
    fn ten_cores_win_and_dash_recharges() {
        let mut g = Run::new();
        g.rocks.clear();
        g.tick(0.01, (1., 0.), true);
        assert!(g.dash > 1.9);
        for _ in 0..10 {
            g.ship.x = g.core.0;
            g.ship.y = g.core.1;
            g.tick(0.01, (0., 0.), false);
        }
        assert_eq!(g.score, 10);
        assert!(g.over && g.won);
    }
    #[test]
    fn damage_has_grace_and_no_underflow() {
        let mut g = Run::new();
        g.shield = 0.;
        g.rocks = vec![g.ship];
        g.tick(0.01, (0., 0.), false);
        assert_eq!(g.lives, 2);
        g.tick(0.01, (0., 0.), false);
        assert_eq!(g.lives, 2);
        g.lives = 1;
        g.shield = 0.;
        g.rocks = vec![g.ship];
        g.tick(0.01, (0., 0.), false);
        g.tick(0.01, (0., 0.), false);
        assert_eq!(g.lives, 0);
        assert!(g.over);
    }
}
