(function (global) {
    var startUp = global.startUp = {
        version: "1.0.1",
    }

    var data = {}; // 获取当前框架内置信息,配置信息
    var cache = {}; // 缓存对象
    var anonymousMeta = {}; //子模块依赖项

    //模块的生命周期
    var status = {
        FETCHED: 1, // 正在当前模块获取uri
        SAVED: 2, // 缓存中存储模块数据信息
        LOADING: 3, // 正在加载当前模块依赖项
        LOADED: 4, // 准备执行当前模块
        EXECUTING: 5, // 正在执行当前模块
        EXECUTED: 6, // 执行完毕依赖并返回 返回值
    }

    var isArray = function (obj) {
        return toString.call(obj) === "[object Array]";
    }

    var isFunction = function (obj) {
        return toString.call(obj) === "[object Function]";
    }

    var isString = function (obj) {
        return toString.call(obj) === "[object String]";
    }

    /**
     * 是否使用了别名
     * @param {String} id 路径
     */
    function parseAlias(id) { //a  b
        var alias = data.alias; // 配置
        return alias && isString(alias[id]) ? alias[id] : id;
    }

    //不能以"/" ":"开头  结尾必须是一个"/" 后面跟随任意字符至少一个
    var PATHS_RE = /^([^\/:]+)(\/.+)$/; //([^\/:]+)   路径的短名称配置

    /**
     * 是否使用了别名
     * @param {String} id 路径
     */
    function parsePaths(id) {
        var paths = data.paths; //配置
        if (paths && (m = id.match(PATHS_RE)) && isString(paths[m[1]])) {
            id = paths[m[1]] + m[2]
        }
        return id;
    }

    /**
     * 检测是否添加后缀
     * @param {String} path 路径
     */
    function normalize(path) {
        var last = path.length - 1;
        var lastC = path.charAt(last);
        return (lastC === "/" || path.substring(last - 2) === ".js") ? path : path + ".js";
    }

    /**
     * 添加根目录
     * @param {String} id 子路径 a.js
     * @param {String} uri 父路径 http://127.0.0.1:3999/2/_use_0
     * @return {String} result http://127.0.0.1:3999/2/a.js
     */
    function addBase(id, uri) {
        var result;
        if (id.charAt(0) === ".") {
            result = realpath((uri ? uri.match(/[^?]*\//)[0] : data.cwd) + id);
        } else {
            result = data.cwd + id;
        }
        return result;
    }

    var DOT_RE = /\.\//g; // /a/b/./c/./d => /a/b/c/d
    var DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//; // a/b/c/../../d => a/b/../d => a/d
    /**
     * 规范路径 "/./" => "/"
     * @param {String} path 路径
     */
    function realpath(path) {
        path = path.replace(DOT_RE, "/");
        return path;
    }

    /**
     * 生成绝对路径
     * @param {String} child 子路径
     * @param {String} parent 父路径
     */
    startUp.resolve = function (child, parent) {
        if (!child) return "";
        child = parseAlias(child); //检测是否有别名
        child = parsePaths(child); // 检测是否有路径别名 依赖模块中引包的模块路径地址 require("app/c");
        child = normalize(child); //检测是否添加后缀
        return addBase(child, parent); //添加根目录
    }

    /**
     * 引入当前模块
     * @param {String} url 路径
     * @param {Function} callback
     */
    startUp.request = function (url, callback) {
        var node = document.createElement("script");
        node.src = url;
        document.body.appendChild(node);
        node.onload = function () {
            // node.onload = null;
            // document.body.removeChild(node);
            callback();
        }
    }

    /**
     * 构造函数 模块初始化数据
     */
    function Module(uri, deps) {
        this.uri = uri; // 当前模块的绝对路径地址
        this.deps = deps || []; // 当前模块依赖列表
        this.exports = null; // 当前模块对外暴露返回值
        this.status = 0; // 当前模块状态
        this._waitings = {}; // 有多少个依赖项
        this._remain = 0; // 还有多少未加载的依赖项
    }
    /**
     * 分析主干(左子树 | 右子树) 上的依赖项
     */
    Module.prototype.load = function () {
        var module = this; // -> Module实例对象
        module.status = status.LOADING; // 3 => 正在加载当前模块依赖项
        var uris = module.resolve(); //获取主干上的依赖项地址列表 => ["http://127.0.0.1:3999/2/a.js", "http://127.0.0.1:3999/2/b.js"]
        var len = module._remain = uris.length; // 未加载依赖项数量

        //加载主干上的依赖项(模块)
        var m; // 每个依赖项实例
        for (var i = 0; i < len; i++) { // 循环加载模块
            m = Module.get(uris[i]); // 创建每个依赖项缓存信息，注册
            if (m.status < status.LOADED) { // 4 => 准备执行当前模块
                m._waitings[module.uri] = m._waitings[module.uri] || 1;
            } else {
                module._remain--;
            }
        }

        // 如果依赖列表模块全都加载完毕
        if (module._remain == 0) {
            // 准备执行当前模块
            module.onload();
        };

        //准备执行根目录下的依赖列表中的模块
        var requestCache = {};
        for (var i = 0; i < len; i++) {
            m = Module.get(uris[i]); // 返回
            if (m.status < status.FETCHED) { // 5 => 正在获取当前模块
                m.fetch(requestCache);
            }
        }

        for (uri in requestCache) {
            requestCache[uri]();
        }
    }

    /**
     * 加载依赖列表中的模块
     */
    Module.prototype.fetch = function (requestCache) {
        var module = this;
        module.status = status.FETCHED; // 5 => 正在获取当前模块
        var uri = module.uri; // 依赖模块绝对路径地址 => http://127.0.0.1:3999/4/a.js
        requestCache[uri] = sendRequest;

        function sendRequest() {
            //Document.createElement("script") 动态加载script
            startUp.request(uri, onRequest);
        }

        function onRequest() {
            if (anonymousMeta) { // 模块的数据更新(如果有子模块依赖)
                module.save(uri, anonymousMeta);
            }
            module.load(); //递归 如果有子模块，继续加载
        }
    }

    /**
     * 执行模块
     */
    Module.prototype.onload = function () {
        var mod = this; // -> a.js/b.js实例对象
        mod.status = status.LOADED; // 4 => 准备执行当前模块
        if (mod.callback) { // 获取模块返回值
            mod.callback();
        }
        // 尾递归
        var _waitings = mod._waitings; // 哪个模块依赖与本模块
        var uri, m;
        for (uri in _waitings) {
            //console.log(uri);   //根目录对应的Module实例对象
            m = cache[uri];
            m._remain -= _waitings[uri];
            if (m._remain == 0) {
                m.onload()
            };
        }
    }

    /**
     * 如果子模块有依赖项，更改子模块初始化数据
     */
    Module.prototype.save = function (uri, meta) {
        var module = Module.get(uri); //是否在缓存
        module.id = uri;
        module.deps = meta.deps || [];
        module.factory = meta.factory;
        module.status = status.SAVED; // 2 => 缓存中存储模块数据信息
    }

    //获取模块对外的返回值
    Module.prototype.exec = function () {
        var module = this;
        //防止重复执行
        if (module.status >= status.EXECUTING) { // 5 => 正在执行当前模块
            return module.exports;
        }
        module.status = status.EXECUTING; // 5 => 正在执行当前模块
        var uri = module.uri;

        function require(id) {
            //console.log(require.resolve(id));   //更新过后的数据
            return Module.get(require.resolve(id)).exec(); //获取返回值
        }

        require.resolve = function (id) {
            return startUp.resolve(id, uri);
        }

        var factory = module.factory; // 依赖模块传入的函数 function (require, exports, module) {}
        var exports = isFunction(factory) ? factory(require, module.exports = {}, module) : factory;

        if (exports === undefined) {
            exports = module.exports;
        }
        module.exports = exports;
        module.status = status.EXECUTED; // 6 => 执行完毕依赖并返回 返回值
        return exports;
    }

    /**
     * 资源定位 解析依赖项生成绝对路径
     * @return {Array} uris ["http://127.0.0.1:3999/2/a.js", "http://127.0.0.1:3999/2/b.js"]
     */
    Module.prototype.resolve = function () {
        var mod = this;
        var ids = mod.deps; //["./a","./b"]
        var uris = [];
        for (var i = 0; i < ids.length; i++) {
            uris[i] = startUp.resolve(ids[i], mod.uri); //依赖项   (主干| 子树)
        }
        return uris;
    }

    /**
     * 定义一个模块
     * @param {Function} factory function (require, exports, module) {}
     */
    Module.define = function (factory) {
        var deps;
        if (isFunction(factory)) {
            //正则解析依赖项(获取依赖)
            deps = parseDependencies(factory.toString());
        }
        //存储当前模块的信息
        var meta = {
            id: "",
            uri: "",
            deps: deps,
            factory: factory
        }
        anonymousMeta = meta; // 子模块的依赖项
    }

    /**
     * 检测缓存对象上是否有当前模块信息
     * @param {String} uri 当前模块绝对路径
     * @param {Array} deps 依赖项列表
     */
    Module.get = function (uri, deps) {
        return cache[uri] || (cache[uri] = new Module(uri, deps));
    }

    /**
     * 资源定位
     * @param {Array} deps 主模块依赖项列表
     * @param {Function} callback 主模块函数
     * @param {String} uri 当前模块根目录(加版本)) http://127.0.0.1:3999/4/_use_0
     */
    Module.use = function (deps, callback, uri) {
        // 检测缓存对象上是否有该模块信息
        var module = Module.get(uri, isArray(deps) ? deps : [deps]);

        //所有模块都加载完毕
        module.callback = function () {
            var exports = []; //所有依赖项模块的返回值
            var uris = module.resolve(); // 获取依赖项列表
            for (var i = 0; i < uris.length; i++) {
                exports[i] = cache[uris[i]].exec(); //获取模块对外定义的返回值
            }
            if (callback) {
                callback.apply(global, exports); // exports 依赖模块返回值
            }
        }

        // 分析主干(左子树 | 右子树) 上的依赖项
        module.load();
    }

    var _cid = 0;

    function cid() {
        return _cid++;
    };

    //获取当前项目文档的URL
    data.cwd = document.URL.match(/[^?]*\//)[0];

    Module.preload = function (callback) {
        var preloadMods = data.preload || []
        var length = preloadMods.length;
        if (length) {
            Module.use(preloadMods, function () {
                preloadMods.splice(0, length)
                Module.preload(callback)
            }, data.cwd + '_preload_' + cid()) // 虚拟的根目录
        } else {
            callback()
        }
        //length !== 0 先加载预先设定模块
    };

    /**
     * 加载器启动函数
     * @param {Array} list 依赖项列表
     * @param {Function} callback 主模块函数
     */
    startUp.use = function (list, callback) {
        //检测有没有预先加载的模块(针对浏览器兼容性，例如浏览器补丁)
        Module.preload(function () {
            Module.use(list, callback, data.cwd + "_use_" + cid()); //虚拟的根目录 -> http://127.0.0.1:3999/2/_use_0
        });
    }

    /**
     * alias配置项
     * @param {object} options 配置项
     */
    startUp.config = function (options) {
        var key;
        for (key in options) {
            data[key] = options[key]; // alias配置
        }
    }

    // 子模块中引用的模块
    var REQUIRE_RE = /\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g

    function parseDependencies(code) {
        var ret = []
        code.replace(REQUIRE_RE, function (m, m1, m2) {
            if (m2) ret.push(m2);
        });
        return ret
    };

    global.define = Module.define;
})(this)