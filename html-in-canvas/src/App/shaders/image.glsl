// VHS Shader
//
// A shader in which I tried to mimic VHS as true as possible :)
//
// It's built up of a few passes:
// - A:      Lowers horizontal resolution of luminance and color/chroma
// - B:      Applies unsharp mask to regain crisp + level/color balancing
// - C:      Interlacing + subtle full screen noise blend
// - D:      Glitches: some warps + white noise lines
// - Image:  Final overall blur + TV vignette
//
// Pass A and B's Unsharp Mask are the bread and butter of the effect, rest is just minor balancing to taste.
// It initially relied heavily on gaussian and box blur, but I achieved similar effects by blurring through mip maps.
//
// Click mouse to A/B between effect and original.
//
// Hope you like it :)

#define FINAL_BLUR_BIAS 1.0
#define VIGNETTE_STRENGTH 2.2
#define SCANLINE_BRIGHTNESS 0.85  // base brightness (0–1), lower = darker lines
#define SCANLINE_DEPTH 0.15       // amplitude of oscillation, higher = more contrast
#define SCANLINE_SIZE 0.005        // scanline period as fraction of screen height, higher = thicker lines

vec4 Televisionfy(in vec4 pixel, const in vec2 uv)
{
    float vignette = pow(uv.x * (1.0 - uv.x) * uv.y * (1.0 - uv.y), 0.25) * VIGNETTE_STRENGTH;
    float scanline = SCANLINE_BRIGHTNESS + SCANLINE_DEPTH * sin(uv.y * 3.14159 / SCANLINE_SIZE);
    return pixel * vignette * scanline;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = fragCoord/iResolution.xy;

    if (iMouse.z <= 0.0)
    {
        fragColor = texture(iChannel0, uv, FINAL_BLUR_BIAS);
        fragColor = Televisionfy(fragColor, uv);
    }
    else
    {
        fragColor = texture(iChannel1, uv);
    }
}
