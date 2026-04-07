#define DEFINE(a) (iResolution.y / 450.0) * a
#define pow2(a) (a * a)
#define PI 3.1415926535897932384626433832795
#define THIRD 1.0 / 3.0
#define BLACK vec4(0.0, 0.0, 0.0, 1.0)
#define WHITE vec4(1.0)
#define W vec3(0.2126, 0.7152, 0.0722)
#define PHI 1.61803398874989484820459
#define SOURCE_FPS 30.0

float GetLuminance(vec3 color)
{
    return W.r * color.r + W.g * color.g + W.b * color.b;
}

float GetLuminance(vec4 color)
{
    return W.r * color.r + W.g * color.g + W.b * color.b;
}

float GetGaussianWeight(vec2 i, float sigma)
{
    return 1.0 / (2.0 * PI * pow2(sigma)) * exp(-((pow2(i.x) + pow2(i.y)) / (2.0 * pow2(sigma))));
}

vec4 Blur(in float size, const in vec2 fragCoord, const in vec2 resolution, const in bool useGaussian, const in sampler2D source, const in float lodBias)
{
    vec4 pixel;
    float sum;

    vec2 uv = fragCoord / resolution;
    vec2 scale = vec2(1.0) / resolution;

    if (!useGaussian)
        size *= THIRD;

    for (float y = -size; y < size; y++)
    {
        if (fragCoord.y + y < 0.0) continue;
        if (fragCoord.y + y >= resolution.y) break;

        for (float x = -size; x < size; x++)
        {
            if (fragCoord.x + x < 0.0) continue;
            if (fragCoord.x + x >= resolution.x) break;

            vec2 uvOffset = vec2(x, y);
            float weight = useGaussian ? GetGaussianWeight(uvOffset, size * 0.25/*sigma, standard deviation*/) : 1.0;
            pixel += texture(source, uv + uvOffset * scale) * weight;
            sum += weight;
        }
    }

    return pixel / sum;
}

float GoldNoise(const in vec2 xy, const in float seed)
{
    //return fract(tan(distance(xy * PHI, xy) * seed) * xy.x);
    return fract(sin(dot(xy * seed, vec2(12.9898, 78.233))) * 43758.5453);
}

// BlendSoftLight credit to Jamie Owen: https://github.com/jamieowen/glsl-blend
float BlendSoftLight(float base, float blend)
{
	return (blend<0.5)?(2.0*base*blend+base*base*(1.0-2.0*blend)):(sqrt(base)*(2.0*blend-1.0)+2.0*base*(1.0-blend));
}

vec4 BlendSoftLight(vec4 base, vec4 blend)
{
	return vec4(BlendSoftLight(base.r,blend.r),BlendSoftLight(base.g,blend.g),BlendSoftLight(base.b,blend.b), 1.0);
}

vec4 BlendSoftLight(vec4 base, vec4 blend, float opacity)
{
	return (BlendSoftLight(base, blend) * opacity + base * (1.0 - opacity));
}
