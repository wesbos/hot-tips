// Unsharp mask + balancing pass

vec4 UnsharpMask(const in float amount, const in float radius, const in float threshold, const in float preBlurBias, const in vec2 fragCoord)
{
    vec2 uv = fragCoord / iResolution.xy;
    vec2 scale = vec2(1.0) / iResolution.xy;

    vec4 pixel = texture(iChannel0, uv, preBlurBias);
    vec4 blurPixel =  texture(iChannel0, uv, preBlurBias + 1.0);// Blur(radius, fragCoord, iResolution.xy, false, iChannel0, preBlurBias * 2.0);

    float lumDelta = abs(GetLuminance(pixel) - GetLuminance(blurPixel));

    if (lumDelta >= threshold)
        pixel = pixel + (pixel - blurPixel) * amount;

    return pixel;
}

vec4 ClampLevels(in vec4 pixel, const in float blackLevel, const in float whiteLevel)
{
    pixel = mix(pixel, BLACK, 1.0 - whiteLevel);
    pixel = mix(pixel, WHITE, blackLevel);

    return pixel;
}

vec4 Saturation(vec4 pixel, float adjustment)
{
    vec3 intensity = vec3(dot(pixel.rgb, W));
    return vec4(mix(intensity, pixel.rgb, adjustment), 1.0);
}

vec4 TintShadows(vec4 pixel, vec3 color)
{
    const float POWER = 1.5;

    // Curve is an approximation of Photoshop's color balance > shadows
    if (color.r > 0.0)
        pixel.r = mix(pixel.r, 1.0 - pow(abs(pixel.r - 1.0), POWER), color.r);
    if (color.g > 0.0)
        pixel.g = mix(pixel.g, 1.0 - pow(abs(pixel.g - 1.0), POWER), color.g);
    if (color.b > 0.0)
        pixel.b = mix(pixel.b, 1.0 - pow(abs(pixel.b - 1.0), POWER), color.b);

    return pixel;
}

const float PRE_BLUR_BIAS = 1.0;
const float UNSHARP_AMOUNT = 2.0;
const float UNSHARP_THRESHOLD = 0.0;
const float BLACK_LEVEL = 0.1;
const float WHITE_LEVEL = 0.9;
const float SATURATION_LEVEL = 0.75;
const vec3 SHADOW_TINT = vec3(0.7, 0.0, 0.9);

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    float UNSHARP_RADIUS = DEFINE(20.0);

    vec4 pixel = UnsharpMask(UNSHARP_AMOUNT, UNSHARP_RADIUS, UNSHARP_THRESHOLD, PRE_BLUR_BIAS, fragCoord);

    pixel = ClampLevels(pixel, BLACK_LEVEL, WHITE_LEVEL);
    pixel = TintShadows(pixel, SHADOW_TINT);
    pixel = Saturation(pixel, SATURATION_LEVEL);

    fragColor = pixel;
}
