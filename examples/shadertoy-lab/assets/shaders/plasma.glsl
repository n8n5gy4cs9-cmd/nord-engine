// Plasma: the smallest useful Shadertoy shader. Paste it as it is.
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;
    vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx * 6.0 + vec3(0, 2, 4));
    col *= 0.6 + 0.4 * sin(10.0 * uv.x + iTime) * sin(10.0 * uv.y - iTime);
    fragColor = vec4(col * 0.55, 1.0);
}
