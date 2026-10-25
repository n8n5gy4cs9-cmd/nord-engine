// CRT post effect for the whole game: used with { type: 'screen' } as iChannel0.
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;
    vec2 d = uv - 0.5;
    uv = 0.5 + d * (1.0 + 0.12 * dot(d, d));                           // barrel curve
    float split = 0.0015 + 0.001 * sin(iTime * 2.0);
    vec3 col = vec3(texture(iChannel0, uv + vec2(split, 0)).r, texture(iChannel0, uv).g, texture(iChannel0, uv - vec2(split, 0)).b);
    col *= 0.85 + 0.15 * sin(uv.y * iResolution.y * 3.14159);        // scan lines
    col *= smoothstep(0.9, 0.3, length(d));                            // vignette
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);
    fragColor = vec4(col, 1.0);
}
