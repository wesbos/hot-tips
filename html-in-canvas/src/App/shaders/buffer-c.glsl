// Interlace + noise grain pass

vec4 Noise(const in float grainSize, const in bool monochromatic, in vec2 fragCoord, float fps)
{
    float seed = fps > 0.0 ? floor(fract(iTime) * fps) / fps : iTime;
    seed += 1.0;

    if (grainSize > 1.0)
    {
        fragCoord.x = floor(fragCoord.x / grainSize);
        fragCoord.y = floor(fragCoord.y / grainSize);
    }

    fragCoord.x += 1.0;

    float r = GoldNoise(fragCoord, seed);
    float g = monochromatic ? r : GoldNoise(fragCoord, seed + 1.0);
    float b = monochromatic ? r : GoldNoise(fragCoord, seed + 2.0);


    return vec4(r, g, b, 1.0);
}

const float NOISE_BLEND = 0.05;

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    float LINE_HEIGHT = DEFINE(2.0);
    float NOISE_GRAIN_SIZE = DEFINE(2.5);

    vec2 uv = fragCoord / iResolution.xy;

    bool updateOddLines = mod(float(iFrame), 2.0) == 0.0;
    bool isOddLine = mod(floor(fragCoord.y), 2.0 * LINE_HEIGHT) >= LINE_HEIGHT;

    if (isOddLine && updateOddLines || !isOddLine && !updateOddLines)
        fragColor = texture(iChannel1, uv);
    else
        fragColor = texture(iChannel0, uv);

    fragColor = BlendSoftLight(fragColor, Noise(NOISE_GRAIN_SIZE, true, fragCoord, SOURCE_FPS), NOISE_BLEND);
}
