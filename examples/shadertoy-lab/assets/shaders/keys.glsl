// Keyboard input: iChannel0 is a 256 x 3 texture. Row 0.25: key is down, row 0.75 (y = 0.5/3 ... ) see the page text.
const int KEY_LEFT = 37, KEY_UP = 38, KEY_RIGHT = 39, KEY_DOWN = 40, KEY_SPACE = 32;
float key(int code) { return texelFetch(iChannel0, ivec2(code, 0), 0).x; }       // 1 while held
float toggle(int code) { return texelFetch(iChannel0, ivec2(code, 2), 0).x; }    // flips on every press
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;
    vec3 col = vec3(0.08, 0.1, 0.14);
    vec2 c[4] = vec2[4](vec2(0.3, 0.5), vec2(0.5, 0.78), vec2(0.7, 0.5), vec2(0.5, 0.22));
    float k[4] = float[4](key(KEY_LEFT), key(KEY_UP), key(KEY_RIGHT), key(KEY_DOWN));
    for (int i = 0; i < 4; i++) col = mix(col, vec3(0.25, 0.85, 0.5), k[i] * smoothstep(0.1, 0.08, length((uv - c[i]) * vec2(iResolution.x / iResolution.y, 1.0))));
    col += vec3(0.9, 0.7, 0.1) * toggle(KEY_SPACE) * step(abs(uv.y - 0.5), 0.03) * step(uv.x, 0.12);
    fragColor = vec4(col, 1.0);
}
