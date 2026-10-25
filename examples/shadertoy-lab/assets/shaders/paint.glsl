// ===== Buffer A | iChannel0: buffer A =====
// Paint with the mouse: Buffer A keeps its own previous frame (iChannel0 = Buffer A) and fades it a little.
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec4 old = texture(iChannel0, fragCoord / iResolution.xy);
    float d = length(fragCoord - iMouse.xy);
    vec3 ink = 0.5 + 0.5 * cos(iTime * 2.0 + vec3(0, 2, 4));
    float stroke = iMouse.z > 0.0 ? smoothstep(10.0, 0.0, d) : 0.0;
    fragColor = vec4(mix(old.rgb * 0.992, ink, stroke), 1.0);
}
// ===== Image | iChannel0: buffer A =====
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragColor = vec4(texture(iChannel0, fragCoord / iResolution.xy).rgb, 1.0);
}
