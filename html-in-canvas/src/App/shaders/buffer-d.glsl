// Warps + noise lines pass

vec2 Tracking(const in float speed, const in float offset, const in float jitter, const in vec2 fragCoord)
{
    float t = 1.0 - mod(iTime, speed) / speed;
    float trackingStart = mod(t * iResolution.y, iResolution.y);
    float trackingJitter = GoldNoise(vec2(5000.0, 5000.0), 10.0 + fract(iTime)) * jitter;

    trackingStart += trackingJitter;

    vec2 uv;
    if (fragCoord.y > trackingStart)
        uv = (fragCoord + vec2(offset, 0)) / iResolution.xy;
    else
        uv = fragCoord / iResolution.xy;

    return uv;
}

vec2 Wave(const in float frequency, const in float offset, const in vec2 fragCoord, const in vec2 uv)
{
    float phaseNumber = floor(fragCoord.y / (iResolution.y / frequency));
    float offsetNoiseModifier = GoldNoise(vec2(1.0 + phaseNumber, phaseNumber), 10.0);

    float offsetUV = sin((uv.y + fract(iTime * 0.05)) * PI * 2.0 * frequency) * ((offset * offsetNoiseModifier) / iResolution.x);

    return uv + vec2(offsetUV, 0.0);
}

vec4 WarpBottom(const in float height, const in float offset, const in float jitterExtent, in vec2 uv)
{
    float uvHeight = height / iResolution.y;
    if (uv.y > uvHeight)
        return texture(iChannel0, uv);

    float t = uv.y / uvHeight;

    float offsetUV = t * (offset / iResolution.x);
    float jitterUV = (GoldNoise(vec2(500.0, 500.0), fract(iTime)) * jitterExtent) / iResolution.x;

    uv = vec2(uv.x - offsetUV - jitterUV, uv.y);

    vec4 pixel = texture(iChannel0, uv);

    pixel = pixel * t;

    return pixel;
}

vec4 WhiteNoise(const in float lineThickness, const in float opacity, const in vec4 pixel, const in vec2 fragCoord)
{
    if (GoldNoise(vec2(600.0, 500.0), fract(iTime) * 10.0) > 0.97) // Draw line?
    {
        float lineStart = floor(GoldNoise(vec2(800.0, 50.0), fract(iTime)) * iResolution.y);
        float lineEnd = floor(lineStart + lineThickness);

        if (floor(fragCoord.y) >= lineStart && floor(fragCoord.y) < lineEnd)
        {
            float frequency = GoldNoise(vec2(850.0, 50.0), fract(iTime)) * 3.0 + 1.0;
            float offset = GoldNoise(vec2(900.0, 51.0), fract(iTime));
            float x = floor(fragCoord.x) / floor(iResolution.x) + offset;
            float white = pow(cos(PI * fract(x * frequency) / 2.0), 10.0) * opacity;
            float grit = GoldNoise(vec2(floor(fragCoord.x /3.0), 800.0), fract(iTime));
            white = max(white - grit * 0.3, 0.0);

            return pixel + white;
        }
    }

    return pixel;
}

const float TRACKING_SPEED = 8.0;
const float WAVE_FREQUENCY = 50.0;
const float TRACKING_JITTER = 20.0;

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    float TRACKING_HORIZONTAL_OFFSET = DEFINE(3.0);
    //float TRACKING_JITTER = DEFINE(20.0);

    float WAVE_OFFSET = DEFINE(0.2);

    float BOTTOM_WARP_HEIGHT = DEFINE(15.0);
    float BOTTOM_WARP_OFFSET = DEFINE(100.0);
    float BOTTOM_WARP_JITTER_EXTENT = DEFINE(50.0);

    float NOISE_HEIGHT = DEFINE(6.0);

    vec2 uv = Tracking(TRACKING_SPEED, TRACKING_HORIZONTAL_OFFSET, TRACKING_JITTER, fragCoord);
    uv = Wave(WAVE_FREQUENCY, WAVE_OFFSET, fragCoord, uv);

    vec4 pixel = WarpBottom(BOTTOM_WARP_HEIGHT, BOTTOM_WARP_OFFSET, BOTTOM_WARP_JITTER_EXTENT, uv);
    pixel = WhiteNoise(NOISE_HEIGHT, 0.3, pixel, fragCoord);

    fragColor = pixel;
}
