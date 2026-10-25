// Audio input: iChannel0 is 512 x 2: row 0 = spectrum (FFT), row 1 = waveform. It is the game's master mix.
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;
    float fft = texture(iChannel0, vec2(uv.x * 0.5, 0.25)).x;
    float bar = step(uv.y, fft);
    vec3 col = mix(vec3(0.05, 0.07, 0.1), 0.5 + 0.5 * cos(6.2831 * (uv.x + vec3(0.0, 0.33, 0.67))), bar);
    fragColor = vec4(col, 1.0);
}
