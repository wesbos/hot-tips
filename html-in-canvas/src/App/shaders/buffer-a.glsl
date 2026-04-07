// Lower resolution of color and luminosity band

vec4 Shrink(in vec2 fragCoord, const in float shrinkRatio, const in float bias)
{
    float scale = 1.0 / iResolution.x;
    float numBands = iResolution.x * shrinkRatio;
    float bandWidth = iResolution.x / numBands;

    // How far are we along the band
    float t = mod(fragCoord.x, bandWidth) / bandWidth;

    // Sample current band in lower res
    fragCoord.x = floor(fragCoord.x * shrinkRatio) / shrinkRatio;
    vec2 uv = fragCoord / iResolution.xy;
    vec4 colorA = texture(iChannel0, uv, bias);

    // Sample next band for interpolation
    uv.x += bandWidth * scale;
    vec4 colorB = texture(iChannel0, uv, bias);

    return mix(colorA, colorB, t);
}

// Based on https://printtechnologies.org/wp-content/uploads/2020/03/pdf-reference-1.6-addendum-blend-modes.pdf
vec3 ClipColor(in vec3 c)
{
    float l = GetLuminance(c);
    float n = min(min(c.r, c.g), c.b);
    float x = max(max(c.r, c.g), c.b);

    if (n < 0.0)
    {
        c.r = l + (((c.r - l) * l) / (l - n));
        c.g = l + (((c.g - l) * l) / (l - n));
        c.b = l + (((c.b - l) * l) / (l - n));
    }

    if (x > 1.0)
    {
        c.r = l + (((c.r - l) * (1.0 - l)) / (x - l));
        c.g = l + (((c.g - l) * (1.0 - l)) / (x - l));
        c.b = l + (((c.b - l) * (1.0 - l)) / (x - l));
    }


    return c;
}

vec3 SetLum(in vec3 c, in float l)
{
    float d = l - GetLuminance(c);
    c += d;

    return ClipColor(c);
}

vec4 BlendColor(const in vec4 base, const in vec4 blend)
{
    vec3 c = SetLum(blend.rgb, GetLuminance(base));
    return vec4(c, blend.a);
}

vec4 BlendLuminosity(const in vec4 base, const in vec4 blend)
{
    vec3 c = SetLum(base.rgb, GetLuminance(blend));
    return vec4(c, blend.a);
}


void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec4 luma = Shrink(fragCoord, 0.5, 0.0); // In VHS the luma band is half of the resolution
    luma = BlendLuminosity(vec4(0.5, 0.5, 0.5, 1.0), luma);

    vec4 chroma = Shrink(fragCoord,  1.0 / 32.0, 3.0); // In VHS chroma band is a much lower resolution (technically 1/16th)
    chroma = BlendColor(luma, chroma);

    fragColor = chroma;
}
