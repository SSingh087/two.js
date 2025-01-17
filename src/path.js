import Commands from './utils/path-commands.js';
import Collection from './collection.js';
import { getComputedMatrix, lerp, mod } from './utils/math.js';
import {
  getComponentOnCubicBezier,
  getCurveBoundingBox,
  getCurveFromPoints,
  subdivide,
  getCurveLength as utilGetCurveLength
} from './utils/curves.js';
import defineGetterSetter from './utils/get-set.js';
import _ from './utils/underscore.js';


import Shape from './shape.js';
import Events from './events.js';
import Vector from './vector.js';
import Anchor from './anchor.js';

import Gradient from './effects/gradient.js';
import LinearGradient from './effects/linear-gradient.js';
import RadialGradient from './effects/radial-gradient.js';
import Texture from './effects/texture.js';

// Constants

var min = Math.min, max = Math.max,
  ceil = Math.ceil, floor = Math.floor;

/**
 * @name Two.Path
 * @class
 * @extends Two.Shape
 * @param {Two.Anchor[]} [vertices] - A list of {@link Two.Anchor}s that represent the order and coordinates to construct the rendered shape.
 * @param {Boolean} [closed=false] - Describes whether the shape is closed or open.
 * @param {Boolean} [curved=false] - Describes whether the shape automatically calculates bezier handles for each vertex.
 * @param {Boolean} [manual=false] - Describes whether the developer controls how vertices are plotted or if Two.js automatically plots coordinates based on closed and curved booleans.
 * @description This is the primary primitive class for creating all drawable shapes in Two.js. Unless specified methods return their instance of `Two.Path` for the purpose of chaining.
 */
function Path(vertices, closed, curved, manual) {

  Shape.call(this);

  this._renderer.type = 'path';
  this._renderer.flagVertices = Path.FlagVertices.bind(this);
  this._renderer.bindVertices = Path.BindVertices.bind(this);
  this._renderer.unbindVertices = Path.UnbindVertices.bind(this);

  this._renderer.flagFill = Path.FlagFill.bind(this);
  this._renderer.flagStroke = Path.FlagStroke.bind(this);
  this._renderer.vertices = [];
  this._renderer.collection = [];

  /**
   * @name Two.Path#closed
   * @property {Boolean} - Determines whether a final line is drawn between the final point in the `vertices` array and the first point.
   */
  this._closed = !!closed;

  /**
   * @name Two.Path#curved
   * @property {Boolean} - When the path is `automatic = true` this boolean determines whether the lines between the points are curved or not.
   */
  this._curved = !!curved;

  /**
   * @name Two.Path#beginning
   * @property {Number} - Number between zero and one to state the beginning of where the path is rendered.
   * @description {@link Two.Path#beginning} is a percentage value that represents at what percentage into the path should the renderer start drawing.
   * @nota-bene This is great for animating in and out stroked paths in conjunction with {@link Two.Path#ending}.
   */
  this.beginning = 0;

  /**
   * @name Two.Path#ending
   * @property {Number} - Number between zero and one to state the ending of where the path is rendered.
   * @description {@link Two.Path#ending} is a percentage value that represents at what percentage into the path should the renderer start drawing.
   * @nota-bene This is great for animating in and out stroked paths in conjunction with {@link Two.Path#beginning}.
   */
  this.ending = 1;

  // Style properties

  /**
   * @name Two.Path#fill
   * @property {(String|Two.Gradient|Two.Texture)} - The value of what the path should be filled in with.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/color_value} for more information on CSS's colors as `String`.
   */
  this.fill = '#fff';

  /**
   * @name Two.Path#stroke
   * @property {(String|Two.Gradient|Two.Texture)} - The value of what the path should be outlined in with.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/color_value} for more information on CSS's colors as `String`.
   */
  this.stroke = '#000';

  /**
   * @name Two.Path#linewidth
   * @property {Number} - The thickness in pixels of the stroke.
   */
  this.linewidth = 1.0;

  /**
   * @name Two.Path#opacity
   * @property {Number} - The opaqueness of the path.
   * @nota-bene Can be used in conjunction with CSS Colors that have an alpha value.
   */
  this.opacity = 1.0;

  /**
   * @name Two.Path#className
   * @property {String} - A class to be applied to the element to be compatible with CSS styling.
   * @nota-bene Only available for the SVG renderer.
   */
  this.className = '';

  /**
   * @name Two.Path#visible
   * @property {Boolean} - Display the path or not.
   * @nota-bene For {@link Two.CanvasRenderer} and {@link Two.WebGLRenderer} when set to false all updating is disabled improving performance dramatically with many objects in the scene.
   */
  this.visible = true;

  /**
   * @name Two.Path#cap
   * @property {String}
   * @see {@link https://www.w3.org/TR/SVG11/painting.html#StrokeLinecapProperty}
   */
  this.cap = 'butt';      // Default of Adobe Illustrator

  /**
   * @name Two.Path#join
   * @property {String}
   * @see {@link https://www.w3.org/TR/SVG11/painting.html#StrokeLinejoinProperty}
   */
  this.join = 'miter';    // Default of Adobe Illustrator

  /**
   * @name Two.Path#miter
   * @property {String}
   * @see {@link https://www.w3.org/TR/SVG11/painting.html#StrokeMiterlimitProperty}
   */
  this.miter = 4;         // Default of Adobe Illustrator

  /**
   * @name Two.Path#vertices
   * @property {Two.Anchor[]} - An ordered list of anchor points for rendering the path.
   * @description A list of {@link Two.Anchor} objects that consist of what form the path takes.
   * @nota-bene The array when manipulating is actually a {@link Two.Collection}.
   */
  this.vertices = vertices;

  /**
   * @name Two.Path#automatic
   * @property {Boolean} - Determines whether or not Two.js should calculate curves, lines, and commands automatically for you or to let the developer manipulate them for themselves.
   */
  this.automatic = !manual;

  /**
   * @name Two.Path#dashes
   * @property {Number[]} - Array of numbers. Odd indices represent dash length. Even indices represent dash space.
   * @description A list of numbers that represent the repeated dash length and dash space applied to the stroke of the text.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray} for more information on the SVG stroke-dasharray attribute.
   */
  this.dashes = [];

  /**
   * @name Two.Path#dashes#offset
   * @property {Number} - A number in pixels to offset {@link Two.Path#dashes} display.
   */
  this.dashes.offset = 0;

}

_.extend(Path, {

  /**
   * @name Two.Path.Properties
   * @property {String[]} - A list of properties that are on every {@link Two.Path}.
   */
  Properties: [
    'fill',
    'stroke',
    'linewidth',
    'opacity',
    'visible',
    'cap',
    'join',
    'miter',

    'closed',
    'curved',
    'automatic',
    'beginning',
    'ending'
  ],

  Utils: {
    getCurveLength: getCurveLength
  },

  /**
   * @name Two.Path.FlagVertices
   * @function
   * @description Cached method to let renderers know vertices have been updated on a {@link Two.Path}.
   */
  FlagVertices: function() {
    this._flagVertices = true;
    this._flagLength = true;
    if (this.parent) {
      this.parent._flagLength = true;
    }
  },

  /**
   * @name Two.Path.BindVertices
   * @function
   * @description Cached method to let {@link Two.Path} know vertices have been added to the instance.
   */
  BindVertices: function(items) {

    // This function is called a lot
    // when importing a large SVG
    var i = items.length;
    while (i--) {
      items[i].bind(Events.Types.change, this._renderer.flagVertices);
    }

    this._renderer.flagVertices();

  },

  /**
   * @name Two.Path.UnbindVertices
   * @function
   * @description Cached method to let {@link Two.Path} know vertices have been removed from the instance.
   */
  UnbindVertices: function(items) {

    var i = items.length;
    while (i--) {
      items[i].unbind(Events.Types.change, this._renderer.flagVertices);
    }

    this._renderer.flagVertices();

  },

  /**
   * @name Two.Path.FlagFill
   * @function
   * @description Cached method to let {@link Two.Path} know the fill has changed.
   */
  FlagFill: function() {
    this._flagFill = true;
  },

  /**
   * @name Two.Path.FlagFill
   * @function
   * @description Cached method to let {@link Two.Path} know the stroke has changed.
   */
  FlagStroke: function() {
    this._flagStroke = true;
  },

  /**
   * @name Two.Path.MakeObservable
   * @function
   * @param {Object} object - The object to make observable.
   * @description Convenience function to apply observable qualities of a {@link Two.Path} to any object. Handy if you'd like to extend the {@link Two.Path} class on a custom class.
   */
  MakeObservable: function(object) {

    Shape.MakeObservable(object);

    // Only the 7 defined properties are flagged like this. The subsequent
    // properties behave differently and need to be hand written.
    _.each(Path.Properties.slice(2, 8), defineGetterSetter, object);

    Object.defineProperty(object, 'fill', {
      enumerable: true,
      get: function() {
        return this._fill;
      },
      set: function(f) {

        if (this._fill instanceof Gradient
          || this._fill instanceof LinearGradient
          || this._fill instanceof RadialGradient
          || this._fill instanceof Texture) {
          this._fill.unbind(Events.Types.change, this._renderer.flagFill);
        }

        this._fill = f;
        this._flagFill = true;

        if (this._fill instanceof Gradient
          || this._fill instanceof LinearGradient
          || this._fill instanceof RadialGradient
          || this._fill instanceof Texture) {
          this._fill.bind(Events.Types.change, this._renderer.flagFill);
        }

      }
    });

    Object.defineProperty(object, 'stroke', {
      enumerable: true,
      get: function() {
        return this._stroke;
      },
      set: function(f) {

        if (this._stroke instanceof Gradient
          || this._stroke instanceof LinearGradient
          || this._stroke instanceof RadialGradient
          || this._stroke instanceof Texture) {
          this._stroke.unbind(Events.Types.change, this._renderer.flagStroke);
        }

        this._stroke = f;
        this._flagStroke = true;

        if (this._stroke instanceof Gradient
          || this._stroke instanceof LinearGradient
          || this._stroke instanceof RadialGradient
          || this._stroke instanceof Texture) {
          this._stroke.bind(Events.Types.change, this._renderer.flagStroke);
        }

      }
    });

    /**
     * @name Two.Path#length
     * @property {Number} - The sum of distances between all {@link Two.Path#vertices}.
     */
    Object.defineProperty(object, 'length', {
      get: function() {
        if (this._flagLength) {
          this._updateLength();
        }
        return this._length;
      }
    });

    Object.defineProperty(object, 'closed', {
      enumerable: true,
      get: function() {
        return this._closed;
      },
      set: function(v) {
        this._closed = !!v;
        this._flagVertices = true;
      }
    });

    Object.defineProperty(object, 'curved', {
      enumerable: true,
      get: function() {
        return this._curved;
      },
      set: function(v) {
        this._curved = !!v;
        this._flagVertices = true;
      }
    });

    Object.defineProperty(object, 'automatic', {
      enumerable: true,
      get: function() {
        return this._automatic;
      },
      set: function(v) {
        if (v === this._automatic) {
          return;
        }
        this._automatic = !!v;
        var method = this._automatic ? 'ignore' : 'listen';
        _.each(this.vertices, function(v) {
          v[method]();
        });
      }
    });

    Object.defineProperty(object, 'beginning', {
      enumerable: true,
      get: function() {
        return this._beginning;
      },
      set: function(v) {
        this._beginning = v;
        this._flagVertices = true;
      }
    });

    Object.defineProperty(object, 'ending', {
      enumerable: true,
      get: function() {
        return this._ending;
      },
      set: function(v) {
        this._ending = v;
        this._flagVertices = true;
      }
    });

    Object.defineProperty(object, 'vertices', {

      enumerable: true,

      get: function() {
        return this._collection;
      },

      set: function(vertices) {

        var bindVertices = this._renderer.bindVertices;
        var unbindVertices = this._renderer.unbindVertices;

        // Remove previous listeners
        if (this._collection) {
          this._collection
            .unbind(Events.Types.insert, bindVertices)
            .unbind(Events.Types.remove, unbindVertices);
        }

        // Create new Collection with copy of vertices
        if (vertices instanceof Collection) {
          this._collection = vertices;
        } else {
          this._collection = new Collection(vertices || []);
        }


        // Listen for Collection changes and bind / unbind
        this._collection
          .bind(Events.Types.insert, bindVertices)
          .bind(Events.Types.remove, unbindVertices);

        // Bind Initial Vertices
        bindVertices(this._collection);

      }

    });

    /**
     * @name Two.Path#mask
     * @property {Two.Shape} - The shape whose alpha property becomes a clipping area for the path.
     * @nota-bene This property is currently not working becuase of SVG spec issues found here {@link https://code.google.com/p/chromium/issues/detail?id=370951}.
     */
    Object.defineProperty(object, 'mask', {

      enumerable: true,

      get: function() {
        return this._mask;
      },

      set: function(v) {
        this._mask = v;
        this._flagMask = true;
        if (!v.clip) {
          v.clip = true;
        }
      }

    });

    /**
     * @name Two.Path#clip
     * @property {Boolean} - Tells Two.js renderer if this object represents a mask for another object (or not).
     */
    Object.defineProperty(object, 'clip', {
      enumerable: true,
      get: function() {
        return this._clip;
      },
      set: function(v) {
        this._clip = v;
        this._flagClip = true;
      }
    });

    Object.defineProperty(object, 'dashes', {
      enumerable: true,
      get: function() {
        return this._dashes;
      },
      set: function(v) {
        if (typeof v.offset !== 'number') {
          v.offset = (this.dashes && this._dashes.offset) || 0;
        }
        this._dashes = v;
      }
    });

  }

});

_.extend(Path.prototype, Shape.prototype, {

  constructor: Path,

  // Flags
  // http://en.wikipedia.org/wiki/Flag

  /**
   * @name Two.Path#_flagVertices
   * @private
   * @property {Boolean} - Determines whether the {@link Two.Path#vertices} need updating.
   */
  _flagVertices: true,

  /**
   * @name Two.Path#_flagLength
   * @private
   * @property {Boolean} - Determines whether the {@link Two.Path#length} needs updating.
   */
  _flagLength: true,

  /**
   * @name Two.Path#_flagFill
   * @private
   * @property {Boolean} - Determines whether the {@link Two.Path#fill} needs updating.
   */
  _flagFill: true,

  /**
   * @name Two.Path#_flagStroke
   * @private
   * @property {Boolean} - Determines whether the {@link Two.Path#stroke} needs updating.
   */
  _flagStroke: true,

  /**
   * @name Two.Path#_flagLinewidth
   * @private
   * @property {Boolean} - Determines whether the {@link Two.Path#linewidth} needs updating.
   */
  _flagLinewidth: true,

  /**
   * @name Two.Path#_flagOpacity
   * @private
   * @property {Boolean} - Determines whether the {@link Two.Path#opacity} needs updating.
   */
  _flagOpacity: true,

  /**
   * @name Two.Path#_flagVisible
   * @private
   * @property {Boolean} - Determines whether the {@link Two.Path#visible} needs updating.
   */
  _flagVisible: true,

  /**
   * @name Two.Path#_flagCap
   * @private
   * @property {Boolean} - Determines whether the {@link Two.Path#cap} needs updating.
   */
  _flagCap: true,

  /**
   * @name Two.Path#_flagJoin
   * @private
   * @property {Boolean} - Determines whether the {@link Two.Path#join} needs updating.
   */
  _flagJoin: true,

  /**
   * @name Two.Path#_flagMiter
   * @private
   * @property {Boolean} - Determines whether the {@link Two.Path#miter} needs updating.
   */
  _flagMiter: true,

  /**
   * @name Two.Path#_flagMask
   * @private
   * @property {Boolean} - Determines whether the {@link Two.Path#mask} needs updating.
   */
  _flagMask: false,

  /**
   * @name Two.Path#_flagClip
   * @private
   * @property {Boolean} - Determines whether the {@link Two.Path#clip} needs updating.
   */
  _flagClip: false,

  // Underlying Properties

  /**
   * @name Two.Path#_length
   * @private
   * @see {@link Two.Path#length}
   */
  _length: 0,

  /**
   * @name Two.Path#_fill
   * @private
   * @see {@link Two.Path#fill}
   */
  _fill: '#fff',

  /**
   * @name Two.Path#_stroke
   * @private
   * @see {@link Two.Path#stroke}
   */
  _stroke: '#000',

  /**
   * @name Two.Path#_linewidth
   * @private
   * @see {@link Two.Path#linewidth}
   */
  _linewidth: 1,

  /**
   * @name Two.Path#_opacity
   * @private
   * @see {@link Two.Path#opacity}
   */
  _opacity: 1.0,

  /**
   * @name Two.Path#_visible
   * @private
   * @see {@link Two.Path#visible}
   */
  _visible: true,

  /**
   * @name Two.Path#_cap
   * @private
   * @see {@link Two.Path#cap}
   */
  _cap: 'round',

  /**
   * @name Two.Path#_join
   * @private
   * @see {@link Two.Path#join}
   */
  _join: 'round',

  /**
   * @name Two.Path#_miter
   * @private
   * @see {@link Two.Path#miter}
   */
  _miter: 4,

  /**
   * @name Two.Path#_closed
   * @private
   * @see {@link Two.Path#closed}
   */
  _closed: true,

  /**
   * @name Two.Path#_curved
   * @private
   * @see {@link Two.Path#curved}
   */
  _curved: false,

  /**
   * @name Two.Path#_automatic
   * @private
   * @see {@link Two.Path#automatic}
   */
  _automatic: true,

  /**
   * @name Two.Path#_beginning
   * @private
   * @see {@link Two.Path#beginning}
   */
  _beginning: 0,

  /**
   * @name Two.Path#_ending
   * @private
   * @see {@link Two.Path#ending}
   */
  _ending: 1.0,

  /**
   * @name Two.Path#_mask
   * @private
   * @see {@link Two.Path#mask}
   */
  _mask: null,

  /**
   * @name Two.Path#_clip
   * @private
   * @see {@link Two.Path#clip}
   */
  _clip: false,

  /**
   * @name Two.Path#_dashes
   * @private
   * @see {@link Two.Path#dashes}
   */
  _dashes: null,

  /**
   * @name Two.Path#clone
   * @function
   * @param {Two.Group} [parent] - The parent group or scene to add the clone to.
   * @returns {Two.Path}
   * @description Create a new instance of {@link Two.Path} with the same properties of the current path.
   */
  clone: function(parent) {

    var clone = new Path();

    for (var j = 0; j < this.vertices.length; j++) {
      clone.vertices.push(this.vertices[j].clone());
    }

    for (var i = 0; i < Path.Properties.length; i++) {
      var k = Path.Properties[i];
      clone[k] = this[k];
    }

    clone.className = this.className;

    clone.translation.copy(this.translation);
    clone.rotation = this.rotation;
    clone.scale = this.scale;
    clone.skewX = this.skewX;
    clone.skewY = this.skewY;

    if (this.matrix.manual) {
      clone.matrix.copy(this.matrix);
    }

    if (parent) {
      parent.add(clone);
    }

    return clone._update();

  },

  /**
   * @name Two.Path#toObject
   * @function
   * @returns {Object}
   * @description Return a JSON compatible plain object that represents the path.
   */
  toObject: function() {

    var result = {
      vertices: this.vertices.map(function(v) {
        return v.toObject();
      })
    };

    _.each(Path.Properties, function(k) {
      if (typeof this[k] !== 'undefined') {
        if (this[k].toObject) {
          result[k] = this[k].toObject();
        } else {
          result[k] = this[k];
        }
      }
    }, this);

    result.className = this.className;

    result.translation = this.translation.toObject();
    result.rotation = this.rotation;
    result.scale = this.scale instanceof Vector ? this.scale.toObject() : this.scale;
    result.skewX = this.skewX;
    result.skewY = this.skewY;

    if (this.matrix.manual) {
      result.matrix = this.matrix.toObject();
    }

    return result;

  },

  /**
   * @name Two.Path#noFill
   * @function
   * @description Short hand method to set fill to `transparent`.
   */
  noFill: function() {
    this.fill = 'transparent';
    return this;
  },

  /**
   * @name Two.Path#noStroke
   * @function
   * @description Short hand method to set stroke to `transparent`.
   */
  noStroke: function() {
    this.stroke = undefined;
    return this;
  },

  /**
   * @name Two.Path#corner
   * @function
   * @description Orient the vertices of the shape to the upper left-hand corner of the path.
   */
  corner: function() {

    var rect = this.getBoundingClientRect(true);
    var hw = rect.width / 2;
    var hh = rect.height / 2;
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;

    for (var i = 0; i < this.vertices.length; i++) {
      var v = this.vertices[i];
      v.x -= cx;
      v.y -= cy;
      v.x += hw;
      v.y += hh;
    }

    return this;

  },

  /**
   * @name Two.Path#center
   * @function
   * @description Orient the vertices of the shape to the center of the path.
   */
  center: function() {

    var rect = this.getBoundingClientRect(true);

    var cx = rect.left + rect.width / 2 - this.translation.x;
    var cy = rect.top + rect.height / 2 - this.translation.y;

    for (var i = 0; i < this.vertices.length; i++) {
      var v = this.vertices[i];
      v.x -= cx;
      v.y -= cy;
    }

    return this;

  },

  /**
   * @name Two.Path#remove
   * @function
   * @description Remove self from the scene / parent.
   */
  remove: function() {

    if (!this.parent) {
      return this;
    }

    this.parent.remove(this);

    return this;

  },

  /**
   * @name Two.Path#getBoundingClientRect
   * @function
   * @param {Boolean} [shallow=false] - Describes whether to calculate off local matrix or world matrix.
   * @returns {Object} - Returns object with top, left, right, bottom, width, height attributes.
   * @description Return an object with top, left, right, bottom, width, and height parameters of the path.
   */
  getBoundingClientRect: function(shallow) {
    var matrix, border, l, i, v0, v1, c0x, c0y, c1x, c1y, a, b, c, d;

    var left = Infinity, right = -Infinity,
        top = Infinity, bottom = -Infinity;

    // TODO: Update this to not __always__ update. Just when it needs to.
    this._update(true);

    matrix = shallow ? this._matrix : getComputedMatrix(this);

    border = (this.linewidth || 0) / 2;
    l = this._renderer.vertices.length;

    if (l <= 0) {
      return {
        width: 0,
        height: 0
      };
    }

    for (i = 0; i < l; i++) {

      v1 = this._renderer.vertices[i];
      // If i = 0, then this "wraps around" to the last vertex. Otherwise, it's the previous vertex.
      // This is important for handling cyclic paths.
      v0 = this._renderer.vertices[(i + l - 1) % l];

      if (v0.controls && v1.controls) {

        c0x = v0.controls.right.x;
        c0y = v0.controls.right.y;

        if (v0.relative) {
          c0x += v0.x;
          c0y += v0.y;
        }

        c1x = v1.controls.left.x;
        c1y = v1.controls.left.y;

        if (v1.relative) {
          c1x += v1.x;
          c1y += v1.y;
        }

        var bb = getCurveBoundingBox(v0.x, v0.y,
          c0x, c0y, c1x, c1y, v1.x, v1.y);

        top = min(bb.min.y - border, top);
        left = min(bb.min.x - border, left);
        right = max(bb.max.x + border, right);
        bottom = max(bb.max.y + border, bottom);

      } else {

        if (i <= 1) {

          top = min(v0.y - border, top);
          left = min(v0.x - border, left);
          right = max(v0.x + border, right);
          bottom = max(v0.y + border, bottom);

        }

        top = min(v1.y - border, top);
        left = min(v1.x - border, left);
        right = max(v1.x + border, right);
        bottom = max(v1.y + border, bottom);

      }

    }

    a = matrix.multiply(left, top, 1);
    b = matrix.multiply(left, bottom, 1);
    c = matrix.multiply(right, top, 1);
    d = matrix.multiply(right, bottom, 1);

    top = min(a.y, b.y, c.y, d.y);
    left = min(a.x, b.x, c.x, d.x);
    right = max(a.x, b.x, c.x, d.x);
    bottom = max(a.y, b.y, c.y, d.y);

    return {
      top: top,
      left: left,
      right: right,
      bottom: bottom,
      width: right - left,
      height: bottom - top
    };

  },

  /**
   * @name Two.Path#getPointAt
   * @function
   * @param {Boolean} t - Percentage value describing where on the {@link Two.Path} to estimate and assign coordinate values.
   * @param {Two.Vector} [object] - Object to apply calculated x, y to. If none available returns new `Object`.
   * @returns {Object}
   * @description Given a float `t` from 0 to 1, return a point or assign a passed `obj`'s coordinates to that percentage on this {@link Two.Path}'s curve.
   */
  getPointAt: function(t, obj) {

    var ia, ib, result;
    var x, x1, x2, x3, x4, y, y1, y2, y3, y4, left, right;
    var target = this.length * Math.min(Math.max(t, 0), 1);
    var length = this.vertices.length;
    var last = length - 1;

    var a = null;
    var b = null;

    for (var i = 0, l = this._lengths.length, sum = 0; i < l; i++) {

      if (sum + this._lengths[i] >= target) {

        if (this._closed) {
          ia = mod(i, length);
          ib = mod(i - 1, length);
          if (i === 0) {
            ia = ib;
            ib = i;
          }
        } else {
          ia = i;
          ib = Math.min(Math.max(i - 1, 0), last);
        }

        a = this.vertices[ia];
        b = this.vertices[ib];
        target -= sum;
        if (this._lengths[i] !== 0) {
          t = target / this._lengths[i];
        } else {
          t = 0;
        }

        break;

      }

      sum += this._lengths[i];

    }

    if (a === null || b === null) {
      return null;
    }

    if (!a) {
      return b;
    } else if (!b) {
      return a;
    }

    right = b.controls && b.controls.right;
    left = a.controls && a.controls.left;

    x1 = b.x;
    y1 = b.y;
    x2 = (right || b).x;
    y2 = (right || b).y;
    x3 = (left || a).x;
    y3 = (left || a).y;
    x4 = a.x;
    y4 = a.y;

    if (right && b.relative) {
      x2 += b.x;
      y2 += b.y;
    }

    if (left && a.relative) {
      x3 += a.x;
      y3 += a.y;
    }

    x = getComponentOnCubicBezier(t, x1, x2, x3, x4);
    y = getComponentOnCubicBezier(t, y1, y2, y3, y4);

    // Higher order points for control calculation.
    var t1x = lerp(x1, x2, t);
    var t1y = lerp(y1, y2, t);
    var t2x = lerp(x2, x3, t);
    var t2y = lerp(y2, y3, t);
    var t3x = lerp(x3, x4, t);
    var t3y = lerp(y3, y4, t);

    // Calculate the returned points control points.
    var brx = lerp(t1x, t2x, t);
    var bry = lerp(t1y, t2y, t);
    var alx = lerp(t2x, t3x, t);
    var aly = lerp(t2y, t3y, t);

    if (_.isObject(obj)) {

      obj.x = x;
      obj.y = y;

      if (!_.isObject(obj.controls)) {
        Anchor.AppendCurveProperties(obj);
      }

      obj.controls.left.x = brx;
      obj.controls.left.y = bry;
      obj.controls.right.x = alx;
      obj.controls.right.y = aly;

      if (!typeof obj.relative === 'boolean' || obj.relative) {
        obj.controls.left.x -= x;
        obj.controls.left.y -= y;
        obj.controls.right.x -= x;
        obj.controls.right.y -= y;
      }

      obj.t = t;

      return obj;

    }

    result = new Anchor(
      x, y, brx - x, bry - y, alx - x, aly - y,
      this._curved ? Commands.curve : Commands.line
    );

    result.t = t;

    return result;

  },

  /**
   * @name Two.Path#plot
   * @function
   * @description Based on closed / curved and sorting of vertices plot where all points should be and where the respective handles should be too.
   * @nota-bene While this method is public it is internally called by {@link Two.Path#_update} when `automatic = true`.
   */
  plot: function() {

    if (this.curved) {
      getCurveFromPoints(this._collection, this.closed);
      return this;
    }

    for (var i = 0; i < this._collection.length; i++) {
      this._collection[i].command = i === 0 ? Commands.move : Commands.line;
    }

    return this;

  },

  /**
   * @name Two.Path#subdivide
   * @function
   * @param {Number} limit - How many times to recurse subdivisions.
   * @description Insert a {@link Two.Anchor} at the midpoint between every item in {@link Two.Path#vertices}.
   */
  subdivide: function(limit) {
    // TODO: DRYness (function below)
    this._update();

    var last = this.vertices.length - 1;
    var b = this.vertices[last];
    var closed = this._closed || this.vertices[last]._command === Commands.close;
    var points = [];
    _.each(this.vertices, function(a, i) {

      if (i <= 0 && !closed) {
        b = a;
        return;
      }

      if (a.command === Commands.move) {
        points.push(new Anchor(b.x, b.y));
        if (i > 0) {
          points[points.length - 1].command = Commands.line;
        }
        b = a;
        return;
      }

      var verts = getSubdivisions(a, b, limit);
      points = points.concat(verts);

      // Assign commands to all the verts
      _.each(verts, function(v, i) {
        if (i <= 0 && b.command === Commands.move) {
          v.command = Commands.move;
        } else {
          v.command = Commands.line;
        }
      });

      if (i >= last) {

        // TODO: Add check if the two vectors in question are the same values.
        if (this._closed && this._automatic) {

          b = a;

          verts = getSubdivisions(a, b, limit);
          points = points.concat(verts);

          // Assign commands to all the verts
          _.each(verts, function(v, i) {
            if (i <= 0 && b.command === Commands.move) {
              v.command = Commands.move;
            } else {
              v.command = Commands.line;
            }
          });

        } else if (closed) {
          points.push(new Anchor(a.x, a.y));
        }

        points[points.length - 1].command = closed
          ? Commands.close : Commands.line;

      }

      b = a;

    }, this);

    this._automatic = false;
    this._curved = false;
    this.vertices = points;

    return this;

  },

  /**
   * @name Two.Path#_updateLength
   * @function
   * @private
   * @param {Number} [limit] -
   * @param {Boolean} [silent=false] - If set to `true` then the path isn't updated before calculation. Useful for internal use.
   * @description Recalculate the {@link Two.Path#length} value.
   */
  _updateLength: function(limit, silent) {
    // TODO: DRYness (function above)
    if (!silent) {
      this._update();
    }

    var length = this.vertices.length;
    var last = length - 1;
    var b = this.vertices[last];
    var closed = false;//this._closed || this.vertices[last]._command === Commands.close;
    var sum = 0;

    if (typeof this._lengths === 'undefined') {
      this._lengths = [];
    }

    _.each(this.vertices, function(a, i) {

      if ((i <= 0 && !closed) || a.command === Commands.move) {
        b = a;
        this._lengths[i] = 0;
        return;
      }

      this._lengths[i] = getCurveLength(a, b, limit);
      sum += this._lengths[i];

      if (i >= last && closed) {

        b = this.vertices[(i + 1) % length];

        this._lengths[i + 1] = getCurveLength(a, b, limit);
        sum += this._lengths[i + 1];

      }

      b = a;

    }, this);

    this._length = sum;
    this._flagLength = false;

    return this;

  },

  /**
   * @name Two.Path#_update
   * @function
   * @private
   * @param {Boolean} [bubbles=false] - Force the parent to `_update` as well.
   * @description This is called before rendering happens by the renderer. This applies all changes necessary so that rendering is up-to-date but not updated more than it needs to be.
   * @nota-bene Try not to call this method more than once a frame.
   */
  _update: function() {

    if (this._flagVertices) {

      if (this._automatic) {
        this.plot();
      }

      if (this._flagLength) {
        this._updateLength(undefined, true);
      }

      var l = this._collection.length;
      var closed = this._closed;

      var beginning = Math.min(this._beginning, this._ending);
      var ending = Math.max(this._beginning, this._ending);

      var bid = getIdByLength(this, beginning * this._length);
      var eid = getIdByLength(this, ending * this._length);

      var low = ceil(bid);
      var high = floor(eid);

      var left, right, prev, next, v;

      this._renderer.vertices.length = 0;

      for (var i = 0; i < l; i++) {

        if (this._renderer.collection.length <= i) {
          // Expected to be `relative` anchor points.
          this._renderer.collection.push(new Anchor());
        }

        if (i > high && !right) {

          v = this._renderer.collection[i];
          v.copy(this._collection[i]);
          this.getPointAt(ending, v);
          v.command = this._renderer.collection[i].command;
          this._renderer.vertices.push(v);

          right = v;
          prev = this._collection[i - 1];

          // Project control over the percentage `t`
          // of the in-between point
          if (prev && prev.controls) {

            v.controls.right.clear();

            this._renderer.collection[i - 1].controls.right
              .clear()
              .lerp(prev.controls.right, v.t);

          }

        } else if (i >= low && i <= high) {

          v = this._renderer.collection[i]
            .copy(this._collection[i]);
          this._renderer.vertices.push(v);

          if (i === high && contains(this, ending)) {
            right = v;
            if (!closed && right.controls) {
              right.controls.right.clear();
            }
          } else if (i === low && contains(this, beginning)) {
            left = v;
            left.command = Commands.move;
            if (!closed && left.controls) {
              left.controls.left.clear();
            }
          }

        }

      }

      // Prepend the trimmed point if necessary.
      if (low > 0 && !left) {

        i = low - 1;

        v = this._renderer.collection[i];
        v.copy(this._collection[i]);
        this.getPointAt(beginning, v);
        v.command = Commands.move;
        this._renderer.vertices.unshift(v);

        left = v;
        next = this._collection[i + 1];

        // Project control over the percentage `t`
        // of the in-between point
        if (next && next.controls) {

          v.controls.left.clear();

          this._renderer.collection[i + 1].controls.left
            .copy(next.controls.left)
            .lerp(Vector.zero, v.t);

        }

      }

    }

    Shape.prototype._update.apply(this, arguments);

    return this;

  },

  /**
   * @name Two.Path#flagReset
   * @function
   * @private
   * @description Called internally to reset all flags. Ensures that only properties that change are updated before being sent to the renderer.
   */
  flagReset: function() {

    this._flagVertices = this._flagLength = this._flagFill =  this._flagStroke =
      this._flagLinewidth = this._flagOpacity = this._flagVisible =
      this._flagCap = this._flagJoin = this._flagMiter =
      this._flagClip = false;

    Shape.prototype.flagReset.call(this);

    return this;

  }

});

Path.MakeObservable(Path.prototype);

  // Utility functions

function contains(path, t) {

  if (t === 0 || t === 1) {
    return true;
  }

  var length = path._length;
  var target = length * t;
  var elapsed = 0;

  for (var i = 0; i < path._lengths.length; i++) {
    var dist = path._lengths[i];
    if (elapsed >= target) {
      return target - elapsed >= 0;
    }
    elapsed += dist;
  }

  return false;

}

/**
 * @private
 * @param {Two.Path} path - The path to analyze against.
 * @param {Number} target - The target length at which to find an anchor.
 * @returns {Number}
 * @description Return the id of an anchor based on a target length.
 */
function getIdByLength(path, target) {

  var total = path._length;

  if (target <= 0) {
    return 0;
  } else if (target >= total) {
    return path._lengths.length - 1;
  }

  for (var i = 0, sum = 0; i < path._lengths.length; i++) {

    if (sum + path._lengths[i] >= target) {
      target -= sum;
      return Math.max(i - 1, 0) + target / path._lengths[i];
    }

    sum += path._lengths[i];

  }

  return - 1;

}

function getCurveLength(a, b, limit) {
  // TODO: DRYness
  var x1, x2, x3, x4, y1, y2, y3, y4;

  var right = b.controls && b.controls.right;
  var left = a.controls && a.controls.left;

  x1 = b.x;
  y1 = b.y;
  x2 = (right || b).x;
  y2 = (right || b).y;
  x3 = (left || a).x;
  y3 = (left || a).y;
  x4 = a.x;
  y4 = a.y;

  if (right && b._relative) {
    x2 += b.x;
    y2 += b.y;
  }

  if (left && a._relative) {
    x3 += a.x;
    y3 += a.y;
  }

  return utilGetCurveLength(x1, y1, x2, y2, x3, y3, x4, y4, limit);

}

function getSubdivisions(a, b, limit) {
  // TODO: DRYness
  var x1, x2, x3, x4, y1, y2, y3, y4;

  var right = b.controls && b.controls.right;
  var left = a.controls && a.controls.left;

  x1 = b.x;
  y1 = b.y;
  x2 = (right || b).x;
  y2 = (right || b).y;
  x3 = (left || a).x;
  y3 = (left || a).y;
  x4 = a.x;
  y4 = a.y;

  if (right && b._relative) {
    x2 += b.x;
    y2 += b.y;
  }

  if (left && a._relative) {
    x3 += a.x;
    y3 += a.y;
  }

  return subdivide(x1, y1, x2, y2, x3, y3, x4, y4, limit);

}

export default Path;
export { contains, getCurveLength, getIdByLength, getSubdivisions };
