var TEXT_CANVAS_SIZE    = 1000; /* a sufficiently large number */
var EMOJI_SIZE          = 128;
var ANIMATED_EMOJI_SIZE = 64;
var ANIMATION_FRAMES    = 12;

function load_file () {
    var reader = new FileReader();
    reader.onload = function(e) { $("#JS_base-image").attr('src', e.target.result); };
    reader.readAsDataURL($("#JS_file")[0].files[0]);
}

function reload_file () {
    var url    = $("#JS_url").val();
    var filter = window[$("#JS_filter").val()];

    if (url) {
        $("#JS_base-image").attr('src', url);
        if (filter) filter();
    } else {
        var reader = new FileReader();
        reader.onload = function(e) {
            $("#JS_base-image").attr('src', e.target.result);
            if (filter) filter();
        };
        reader.readAsDataURL($("#JS_file")[0].files[0]);
    }
}

function filter_chromakey () {
    var image  = $("#JS_base-image")[0];
    var canvas = document.createElement("canvas");
    var ctx    = canvas.getContext('2d');
    canvas.width  = image.naturalWidth;
    canvas.height = image.naturalHeight;

    ctx.drawImage(image, 0, 0);

    var image_data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var data = image_data.data;
    var base_color = [data[0], data[1], data[2]];

    var queue = [
        [0, 0],
        [canvas.width - 1, 0],
        [0, canvas.height - 1],
        [canvas.width - 1, canvas.height - 1]
    ];

    while (queue.length) {
        var item = queue.shift();
        if (item[0] >= canvas.width || item[1] >= canvas.height || item[0] < 0 || item[1] < 0) {
            continue;
        }

        var ix = (item[1] * canvas.width + item[0]) * 4;
        if (!data[ix + 3]) continue;

        var norm = Math.hypot(
            data[ix] - base_color[0],
            data[ix + 1] - base_color[1],
            data[ix + 2] - base_color[2]
        );
        if (norm < 90) {
            data[ix + 3] = 0;
            queue.push(
                [item[0] - 1, item[1] - 1],
                [item[0],     item[1] - 1],
                [item[0] + 1, item[1] - 1],
                [item[0] - 1, item[1]],
                [item[0] + 1, item[1]],
                [item[0] - 1, item[1] + 1],
                [item[0],     item[1] + 1],
                [item[0] + 1, item[1] + 1]
            );
        }
    }

    ctx.putImageData(image_data, 0, 0);
    $("#JS_base-image").attr('src', canvas.toDataURL("image/png"));
}

function crop_canvas (source_canvas, w, h) {
    var canvas    = document.createElement("canvas");
    var ctx       = canvas.getContext('2d');
    canvas.width  = w;
    canvas.height = h;

    ctx.drawImage(source_canvas, 0, 0, w, h, 0, 0, w, h);

    return canvas;
}

function generate_text_image (text, color, font, align) {
    var canvas = document.createElement("canvas");
    canvas.width  = TEXT_CANVAS_SIZE;
    canvas.height = TEXT_CANVAS_SIZE;

    var ctx = canvas.getContext('2d');
    ctx.fillStyle    = color;
    ctx.font         = font;
    ctx.textBaseline = "top";

    var lines       = text.split("\n");
    var line_widths = lines.map(function (line) { return ctx.measureText(line).width; });
    var total_width = Math.ceil(Math.max.apply(null, line_widths));

    var current_total_height = 0;
    lines.forEach(function (line, ix) {
        ctx.save();
        if (align == "right") {
            ctx.translate(total_width - line_widths[ix], 0)
        } else if (align == "center") {
            ctx.translate((total_width - line_widths[ix]) / 2, 0);
        } else if (align == "stretch") {
            ctx.transform(total_width / line_widths[ix], 0, 0, 1, 0, 0);
        }

        ctx.fillText(line, 0, current_total_height);
        ctx.restore();

        /* measure total height */
        var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (var row = current_total_height; row < canvas.height; row++) {
            for (var column = 0; column < canvas.width; column++) {
                if (data[(row * canvas.width + column) * 4 + 3]) {
                    current_total_height = row;
                    break;
                }
            }
        }
    });

    return crop_canvas(canvas, total_width, current_total_height).toDataURL();
}

function compute_recomended_configuration () {
    var image    = $("#JS_base-image")[0];
    var v        = parseInt($("#JS_v").val());
    var h        = parseInt($("#JS_h").val());
    var trimming = $("#JS_trimming").val();

    var width_ratio  = (EMOJI_SIZE * h) / image.naturalWidth;
    var height_ratio = (EMOJI_SIZE * v) / image.naturalHeight;

    switch ($("#JS_trimming").val()) {
        case "cover":
            var zoom_ratio = Math.max(width_ratio, height_ratio);
            width_ratio = height_ratio = zoom_ratio;
            break;
        case "contain":
            var zoom_ratio = Math.min(width_ratio, height_ratio);
            width_ratio = height_ratio = zoom_ratio;
            break;
    }

    $("#JS_zoom_h").val(width_ratio + "");
    $("#JS_zoom_v").val(height_ratio + "");
    $("#JS_left").val((image.naturalWidth - EMOJI_SIZE / width_ratio * h) / 2 + "");
    $("#JS_top").val(Math.min(0, (image.naturalHeight - EMOJI_SIZE / height_ratio * v) / 2) + "");
    $("#JS_top").removeProp("checked");
}

function effect_kira (keyframe, ctx, cellWidth, cellHeight) {
    ctx.filter = "saturate(1000%) hue-rotate(" + (keyframe * 360) + "deg)";
}

function effect_blink (keyframe, ctx, cellWidth, cellHeight) {
    if (keyframe >= 0.5) {
        ctx.translate(- cellWidth * 2, 0); /* hide */
    }
}

function effect_pyon (keyframe, ctx, cellWidth, cellHeight) {
    var resistance = 1.7; // バウンド時の強さ
    var y
    if(keyframe > 0.7) {
        y = - Math.abs(Math.cos(2 * Math.PI * keyframe)) * (cellHeight / 3)
    } else {
        y = - Math.abs(Math.cos(2 * Math.PI * keyframe)) * (cellHeight / 3) * Math.exp(-keyframe * resistance)
    }
    ctx.transform(1, 0, 0, 1, 0, y + cellHeight / 15);
}

function effect_shadow (keyframe, ctx, cellWidth, cellHeight) {
    ctx.shadowColor = 'black';
    ctx.shadowOffsetY = 7;
    ctx.shadowOffsetX = 7;
}
function effect_natural_blur (keyframe, ctx, cellWidth, cellHeight) {
    var hsv_color = hsvToRgb(0, 0, keyframe)
    ctx.shadowColor = `rgb(${hsv_color[0]}, ${hsv_color[1]}, ${hsv_color[2]})`;
    ctx.shadowBlur = 50*keyframe;
}
function effect_neon(keyframe, ctx, cellWidth, cellHeight) {
    var hsv_color = hsvToRgb(keyframe*360*4%360, 1, 1)
    ctx.shadowColor = `rgb(${hsv_color[0]}, ${hsv_color[1]}, ${hsv_color[2]})`;
    ctx.shadowBlur = 10;
}
function effect_aurora_blur(keyframe, ctx, cellWidth, cellHeight) {
    var hsv_color = hsvToRgb(keyframe*360, 1, 1)
    ctx.shadowColor = `rgb(${hsv_color[0]}, ${hsv_color[1]}, ${hsv_color[2]})`;
    ctx.shadowBlur = 50*keyframe;
}
function effect_shadow_rotate (keyframe, ctx, cellWidth, cellHeight) {
    ctx.shadowColor = 'black';
    ctx.shadowOffsetY = Math.cos(2 * Math.PI * keyframe)*5;
    ctx.shadowOffsetX = Math.sin(2 * Math.PI * keyframe)*5;
}
function effect_patapata (keyframe, ctx, cellWidth, cellHeight) {
    ctx.transform(Math.cos(2 * Math.PI * keyframe), 0, 0, 1, cellWidth * (0.5 - 0.5 * Math.cos(2 * Math.PI * keyframe)), 0);
}

function effect_sidetoside (keyframe, ctx, cellWidth, cellHeight) {
    ctx.transform(1, 0, 0, 1, cellWidth * Math.sin(2 * Math.PI * keyframe), 0);
}
function effect_rotate (keyframe, ctx, cellWidth, cellHeight) {
    ctx.translate(cellWidth / 2, cellHeight / 2);
    ctx.rotate(Math.PI * 2 * keyframe);
    ctx.translate(- cellWidth / 2, - cellHeight / 2);
}

var last_gata = false;
function effect_gatagata (keyframe, ctx, cellWidth, cellHeight) {
    last_gata = !last_gata;
    ctx.translate(cellWidth / 2 + (Math.random() - 0.5) * 4, cellHeight / 2 + (Math.random() - 0.5) * 4);
    ctx.rotate(last_gata ? -0.05 : 0.05);
    ctx.translate(- cellWidth / 2, - cellHeight / 2);
}

function effect_yatta (keyframe, ctx, cellWidth, cellHeight) {
    if (keyframe >= 0.5) {
        ctx.transform(-1, 0, 0, 1, cellWidth, 0);
    }
    ctx.translate(cellWidth / 2, cellHeight / 2);
    ctx.rotate(0.1);
    ctx.translate(- cellWidth / 2, - cellHeight / 2);
    ctx.translate(0, cellHeight / 8 * Math.sin(8 * Math.PI * keyframe));
}

function effect_poyon (keyframe, ctx, cellWidth, cellHeight) {
    if (keyframe < 0.6) {
        ctx.translate(0, - cellHeight / 3 * Math.sin(Math.PI * keyframe / 0.6));
    } else {
        var ratio = Math.sin(Math.PI * (keyframe - 0.6) / 0.4) / 2;
        ctx.transform(1 + ratio, 0, 0, 1 - ratio, - ratio * cellWidth / 2, ratio * cellHeight);
    }
}

function effect_zoom (keyframe, ctx, cellWidth, cellHeight) {
    var zoom = Math.abs(keyframe - 0.5) * 2 - 0.5;
    ctx.transform(1 + zoom, 0, 0, 1 + zoom, - cellWidth / 2 * zoom, - cellHeight / 2 * zoom);
}

function effect_tiritiri (keyframe, ctx, cellWidth, cellHeight) {
    bgColorRGB = [
        parseInt(ctx.fillStyle.substring(1, 3), 16),
        parseInt(ctx.fillStyle.substring(3, 5), 16),
        parseInt(ctx.fillStyle.substring(5, 7), 16)
    ]
    const parentLayerRGBA = getImageDataFourDimension(ctx, cellWidth, cellHeight)
    secondLayerImageData = restoreUint8ClampedArray(
        parentLayerRGBA.map(function(element, index, array) {
            return bgColorRGB.concat(parseInt(255 * Math.random()));
        })
    )
    secondLayer = new ImageData(secondLayerImageData, cellWidth, cellHeight)
    ctx.putImageData(secondLayer, 0, 0)
}

function effect_stripe (keyframe, ctx, cellWidth, cellHeight) {
    const parentLayerRGBA = getImageDataFourDimension(ctx, cellWidth, cellHeight)
    secondLayerImageData = restoreUint8ClampedArray(
        parentLayerRGBA.map(function(element, index, array) {
            return (index % cellHeight) % 3 == 1 ? [0, 0, 0, 0] : element;
        })
    )
    secondLayer = new ImageData(secondLayerImageData, cellWidth, cellHeight)
    ctx.putImageData(secondLayer, 0, 0)
}

function effect_river (keyframe, ctx, cellWidth, cellHeight) {
    bgColorHSV = rgb2hsv(
        parseInt(ctx.fillStyle.substring(1, 3), 16),
        parseInt(ctx.fillStyle.substring(3, 5), 16),
        parseInt(ctx.fillStyle.substring(5, 7), 16)
    )
    const parentLayerRGBA = getImageDataFourDimension(ctx, cellWidth, cellHeight)
    secondLayerImageData = restoreUint8ClampedArray(
        parentLayerRGBA.map(function(element, index, array) {
            return (index+(keyframe*40)) % 40 < 40 && (index+(keyframe*40)) % 40 > 20 ? hsvToRgb(bgColorHSV["h"]+180, 1, 1).concat(255) : element;
        })
    )
    secondLayer = new ImageData(secondLayerImageData, cellWidth, cellHeight)
    ctx.putImageData(secondLayer, 0, 0)
}

function effect_timeMachine (keyframe, ctx, cellWidth, cellHeight) {
    const parentLayerRGBA = getImageDataFourDimension(ctx, cellWidth, cellHeight)
    secondLayerImageData = restoreUint8ClampedArray(
        parentLayerRGBA.map(function(element, index, array) {
            return index % 40 < 40 * keyframe ? hsvToRgb(keyframe * 360 * 4 % 360 + 180, 1, 1).concat(255) : element;
        })
    )
    secondLayer = new ImageData(secondLayerImageData, cellWidth, cellHeight)
    ctx.putImageData(secondLayer, 0, 0)
}

function effect_dizzy (keyframe, ctx, cellWidth, cellHeight) {
    const parentLayerRGBA = getImageDataFourDimension(ctx, cellWidth, cellHeight)
    secondLayerImageData = restoreUint8ClampedArray(
      parentLayerRGBA.map(function(element, index, array) {
          return (index+(keyframe*40)) % 40 < 40 && (index+(keyframe*40)) % 40 > 20 ? hsvToRgb(keyframe * 360 * 4 % 360 + 180, 1, 1).concat(255) : element;
      })
    )
    secondLayer = new ImageData(secondLayerImageData, cellWidth, cellHeight)
    ctx.putImageData(secondLayer, 0, 0)
}

function animation_scroll (keyframe, ctx, image, offsetH, offsetV, width, height, cellWidth, cellHeight) {
    offsetH = (offsetH + image.naturalWidth * keyframe) % image.naturalWidth;
    ctx.drawImage(image, offsetH, offsetV, width, height, 0, 0, cellWidth, cellHeight);
    if (offsetH + width > image.naturalWidth) {
        var endPos = (image.naturalWidth - offsetH) * (cellWidth / width);
        ctx.drawImage(image, 0, offsetV, width, height, endPos, 0, cellWidth, cellHeight);
    }
}

function animation_push (keyframe, ctx, image, offsetH, offsetV, width, height, cellWidth, cellHeight) {
    keyframe = keyframe > 0.75 ? (keyframe - 0.75) * 4 : 0;
    animation_scroll(keyframe, ctx, image, offsetH, offsetV, width, height, cellWidth, cellHeight);
}

function render_result_cell (image, offsetH, offsetV, width, height, animation, effects, framerate, background) {
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext('2d');

    if (!animation && !effects.length) {
        canvas.width = EMOJI_SIZE;
        canvas.height = EMOJI_SIZE;
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, EMOJI_SIZE, EMOJI_SIZE);
        ctx.drawImage(image, offsetH, offsetV, width, height, 0, 0, EMOJI_SIZE, EMOJI_SIZE);

        return canvas.toDataURL();
    } else {
        canvas.width = ANIMATED_EMOJI_SIZE;
        canvas.height = ANIMATED_EMOJI_SIZE;

        var encoder = new GIFEncoder();
        encoder.setRepeat(0);
        encoder.setFrameRate(framerate);
        encoder.start();
        for (var i = 0; i < ANIMATION_FRAMES; i++) {
            ctx.save();
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, ANIMATED_EMOJI_SIZE, ANIMATED_EMOJI_SIZE);
            effects.forEach(function (effect) { effect(i / ANIMATION_FRAMES, ctx, ANIMATED_EMOJI_SIZE, ANIMATED_EMOJI_SIZE); });
            if (animation) {
                animation(i / ANIMATION_FRAMES, ctx, image, offsetH, offsetV, width, height, ANIMATED_EMOJI_SIZE, ANIMATED_EMOJI_SIZE);
            } else {
                ctx.drawImage(image, offsetH, offsetV, width, height, 0, 0, ANIMATED_EMOJI_SIZE, ANIMATED_EMOJI_SIZE);
            }
            ctx.restore();
            encoder.addFrame(ctx);
        }
        encoder.finish();

        return "data:image/gif;base64," + encode64(encoder.stream().getData());
    }
}

//親レイヤーからピクセル情報を取得し、４次元を持つ配列として返す([R,G,B,Alpha])
function getImageDataFourDimension(ctx, cellWidth, cellHeight) {
    return ctx.getImageData(0, 0, cellWidth, cellHeight).data.reduce(function(previous, current) {
        const enDivide = previous[previous.length - 1]
        if (enDivide.length === 4) {
            previous.push([current])
            return previous
        }
        enDivide.push(current)
        return previous
    },[[]])
}

//4次元の配列を1次元に戻し、Uint8ClampedArray型で返す
function restoreUint8ClampedArray (origin) {
    return(
        new Uint8ClampedArray(
            origin.reduce( //一次元に戻す
                function(accumulator, currentValue) {
                    return accumulator.concat(currentValue);
                }, []
            )
        )
    )
}

//from https://qiita.com/hachisukansw/items/633d1bf6baf008e82847
function hsvToRgb(H,S,V) {
    //https://en.wikipedia.org/wiki/HSL_and_HSV#From_HSV

    var C = V * S;
    var Hp = H / 60;
    var X = C * (1 - Math.abs(Hp % 2 - 1));

    var R, G, B;
    if (0 <= Hp && Hp < 1) {[R,G,B]=[C,X,0]};
    if (1 <= Hp && Hp < 2) {[R,G,B]=[X,C,0]};
    if (2 <= Hp && Hp < 3) {[R,G,B]=[0,C,X]};
    if (3 <= Hp && Hp < 4) {[R,G,B]=[0,X,C]};
    if (4 <= Hp && Hp < 5) {[R,G,B]=[X,0,C]};
    if (5 <= Hp && Hp < 6) {[R,G,B]=[C,0,X]};

    var m = V - C;
    [R, G, B] = [R+m, G+m, B+m];

    R = Math.floor(R * 255);
    G = Math.floor(G * 255);
    B = Math.floor(B * 255);

    return [R ,G, B];
}

//from https://stackoverflow.com/questions/8022885/rgb-to-hsv-color-in-javascript
function rgb2hsv () {
    var rr, gg, bb,
        r = arguments[0] / 255,
        g = arguments[1] / 255,
        b = arguments[2] / 255,
        h, s,
        v = Math.max(r, g, b),
        diff = v - Math.min(r, g, b),
        diffc = function(c){
            return (v - c) / 6 / diff + 1 / 2;
        };

    if (diff == 0) {
        h = s = 0;
    } else {
        s = diff / v;
        rr = diffc(r);
        gg = diffc(g);
        bb = diffc(b);

        if (r === v) {
            h = bb - gg;
        }else if (g === v) {
            h = (1 / 3) + rr - bb;
        }else if (b === v) {
            h = (2 / 3) + gg - rr;
        }
        if (h < 0) {
            h += 1;
        }else if (h > 1) {
            h -= 1;
        }
    }
    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        v: Math.round(v * 100)
    };
}

function render_results () {
    var image        = $("#JS_base-image")[0];
    var v            = parseInt($("#JS_v").val());
    var h            = parseInt($("#JS_h").val());
    var width_ratio  = parseFloat($("#JS_zoom_h").val());
    var height_ratio = parseFloat($("#JS_zoom_v").val());
    var left         = parseInt($("#JS_left").val());
    var top          = parseInt($("#JS_top").val());
    var framerate    = parseInt($("#JS_framerate").val());
    var animation    = window[$("#JS_animation").val()];
    var effects      = $(".JS_effect:checked").map(function () { return window[$(this).val()]; }).toArray();
    var background   = $("#JS_background_color").val();

    var cell_width = EMOJI_SIZE / width_ratio;
    var cell_height = EMOJI_SIZE / height_ratio;
    var $results = $("#JS_results");
    $results.html("");
    for (var y = 0; y < v; y++) {
        for (var x = 0; x < h; x++) {
            var url = render_result_cell(
                image,
                left + x * cell_width, top + y * cell_height,
                cell_width, cell_height,
                animation, effects, framerate, background
            );
            $results.append("<img width='" + EMOJI_SIZE + "px' src='" + url +"'>");
        }
        $results.append("<br>");
    }
}

$(function() {
    $("#JS_file").change(load_file);
    $("#JS_file,#JS_url").change(function () { $("#JS_filter").val(""); });
    $("#JS_reload").click(reload_file);
    $("#JS_generate").click(function () {
        $("#JS_base-image").attr('src', generate_text_image(
            $("#JS_text").val(),
            $("#JS_text_color").val(),
            $("#JS_text_font").val(),
            $("#JS_text_align").val()
        ));
    });
    $("#JS_base-image").bind('load', compute_recomended_configuration);
    $("#JS_h,#JS_v,#JS_trimming").change(compute_recomended_configuration);
    $("#JS_render").click(render_results);
    $("#JS_toggle_details").click(function () { $(this).remove(); $("#JS_details").show(); });
    $("#JS_toggle_image_details").click(function () { $(this).remove(); $("#JS_image_details").show(); });
});
