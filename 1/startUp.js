(function (global) {
    var startUp = global.startUp = {
        version: "1.0.1",
    }

    var data = {}; // 获取当前框架内置信息
    var cache = {}; // 缓存对象

    //模块的生命周期
    var status = {
        FETCHED: 1, // 正在当前模块获取uri
        SAVED: 2, // 缓存中存储模块数据信息
        LOADING: 3, // 正在加载当前模块依赖项
        LOADED: 4, // 准备执行当前模块
        EXECUTING: 5, // 正在执行当前模块
        EXECUTED: 6, // 执行完毕接口对象以获取
    }

    var isArray = function (obj) {
        return toString.call(obj) === "[object Array]";
    }

    /**
     * 构造函数 模块初始化数据
     */
    function Module(uri, deps) {
        this.uri = uri; // 当前模块的绝对路径地址
        this.deps = deps || []; // 当前模块依赖列表
        this.exports = null; // 当前模块对外暴露接口对象
        this.status = 0; // 当前模块状态
        this._waitings = {}; // 有多少个依赖项
        this._remain = 0; // 还有多少未加载的依赖项
    }
    /**
     * 分析主干(左子树 | 右子树) 上的依赖项
     */
    Module.prototype.load = function () {
        var module = this;
        module.status = status.LOADING;
        //var uris = module.resolve(); //获取主干上的依赖项
        //var len = module._remain = uris.length;  
        //加载主干上的依赖项(模块)
    }

    /**
     * 资源定位
     */
    Module.prototype.resolve = function () {

    }

    /**
     * 定义一个模块
     */
    Module.define = function (factory) {

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
     * @param {Array} deps 依赖项列表
     * @param {Function} callback 执行函数
     * @param {String} uri 当前模块绝对路径 
     */
    Module.use = function (deps, callback, uri) {
        // 检测缓存对象上是否有该模块信息
        var module = Module.get(uri, isArray(deps) ? deps : [deps]);
        console.log(module)
        //所有模块都加载完毕
        module.callback = function () {

        }
        module.load();
    }

    var _cid = 0;

    function cid() {
        return _cid++;
    };

    // 需要配置项
    data.preload = [];

    //获取当前项目文档的URL
    data.cwd = document.URL.match(/[^?]*\//)[0];

    Module.preload = function (callback) {
        var length = data.preload.length;
        if (!length) callback();
        //length !== 0 先加载预先设定模块
    };


    /**
     * 启动函数
     * @param {Array} list 依赖项列表
     * @param {Function} callback 执行函数
     */
    startUp.use = function (list, callback) {
        //检测有没有预先加载的模块(针对浏览器兼容性，例如浏览器补丁)
        Module.preload(function () {
            Module.use(list, callback, data.cwd + "_use_" + cid()); //虚拟的根目录
        });
    }

    global.define = Module.define;
})(this)