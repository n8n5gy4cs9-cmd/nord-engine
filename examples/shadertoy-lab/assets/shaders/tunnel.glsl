// Tunnel: polar coordinates, no textures.
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float a = atan(p.y, p.x), r = length(p);
    vec2 uv = vec2(0.3 / r + iTime * 0.6, a / 3.14159265);
    float checker = mod(floor(uv.x * 4.0) + floor(uv.y * 8.0), 2.0);
    vec3 col = mix(vec3(0.05, 0.1, 0.35), vec3(0.95, 0.55, 0.15), checker) * smoothstep(0.0, 0.35, r);
    fragColor = vec4(col, 1.0);
}
