function measureAndNotifyParent() {
    var height = 0;

    document.body.style.margin = '0';
    document.body.style.padding = '0';

    window.parent.postMessage({ type: 'started' }, '*');

    function notifySize() {
        var newHeight = document.body.offsetHeight;

        if (height !== newHeight) {
            height = newHeight;

            if (window.parent) {
                window.parent.postMessage({ type: 'resize', height: height }, '*');
            }
        }

        window.parent.postMessage({ type: 'resize', height: height }, '*');
    }

    notifySize();

    return setInterval(function () {
        notifySize();
    }, 50);
}

function isNumber(value) {
    return typeof value === 'number';
}

function isString(value) {
    return typeof value === 'string';
}

function isFunction(value) {
    return typeof value === 'function';
}

function isArrayOfStrings(value) {
    if (!Array.isArray(value)) {
        return false;
    }

    for (var i = 0; i < value.length; i++) {
        if (!isString(value[i])) {
            return false;
        }
    }

    return true;
}

/**
 * Creates a new plugin for sidebars.
 * 
 * @param {object} options with the accepted origins.
 */
function SquidexSidebar(options) {
    var initHandler;
    var initCalled = false;
    var contentHandler;
    var content;
    var context;
    var timer;
    var acceptedOrigins = options && isArrayOfStrings(options.acceptedOrigins) ? options.acceptedOrigins : null;

    function raiseContentChanged() {
        if (contentHandler && content) {
            contentHandler(content);
        }
    }

    function raiseInit() {
        if (initHandler && !initCalled && context) {
            initHandler(context);
            initCalled = true;
        }
    }

    function eventListener(event) {
        if (acceptedOrigins && acceptedOrigins.indexOf(event.origin) < 0) {
            console.log('Origin not accepted: ' + event.origin);
            return;
        }

        if (event.source === window) {
            return;
        }

        var type = event.data.type;
        
        if (type === 'contentChanged') {
            content = event.data.content;

            raiseContentChanged();
        } else if (type === 'init') {
            context = event.data.context;

            raiseInit();
        }

        console.log('Received Message: ' + type);
    }

    window.addEventListener('message', eventListener, false);

    timer = measureAndNotifyParent();

    var plugin = {
        /**
         * Get the current context.
         */
        getContext: function () {
            return context;
        },

        /**
         * Notifies the parent to navigate to the path.
         */
        navigate: function (url) {
            if (window.parent) {
                window.parent.postMessage({ type: 'navigate', url: url }, '*');
            }
        },

        /**
         * Register an function that is called when the sidebar is initialized.
         *
         * @param {function} callback: The callback to invoke.
         */
        onInit: function (callback) {
            if (!isFunction(callback)) {
                return;
            }

            initHandler = callback;

            raiseInit();
        },

        /**
         * Register an function that is called whenever the value of the content has changed.
         *
         * @param {function} callback: The callback to invoke. Argument 1: Content value (any).
         */
        onContentChanged: function (callback) {
            if (!isFunction(callback)) {
                return;
            }

            contentHandler = callback;

            raiseContentChanged();
        },

        /**
         * Clean the editor SDK.
         */
        clean: function () {
            if (timer) {
                window.removeEventListener('message', eventListener);

                timer();
            }
        }
    };

    return plugin;
}

var SquidexPlugin = SquidexSidebar;


/**
 * Creates a new plugin for widgets.
 * 
 * @param {object} options with the accepted origins.
 */
function SquidexWidget(options) {
    var initHandler;
    var initCalled = false;
    var context;
    var acceptedOrigins = options && isArrayOfStrings(options.acceptedOrigins) ? options.acceptedOrigins : null;

    document.body.style.margin = '0';
    document.body.style.padding = '0';

    function raiseInit() {
        if (initHandler && !initCalled && context) {
            initHandler(context);
            initCalled = true;
        }
    }

    function eventListener(event) {
        if (acceptedOrigins && acceptedOrigins.indexOf(event.origin) < 0) {
            console.log('Origin not accepted: ' + event.origin);
            return;
        }

        if (event.source === window) {
            return;
        }

        var type = event.data.type;
        
        if (type === 'init') {
            context = event.data.context;

            raiseInit();
        }

        console.log('Received Message: ' + type);
    }

    window.addEventListener('message', eventListener, false);

    var plugin = {
        /**
         * Get the current context.
         */
        getContext: function () {
            return context;
        },

        /**
         * Register an function that is called when the sidebar is initialized.
         *
         * @param {function} callback: The callback to invoke.
         */
        onInit: function (callback) {
            if (!isFunction(callback)) {
                return;
            }

            initHandler = callback;

            raiseInit();
        },

        /**
         * Clean the editor SDK.
         */
        clean: function () {
            window.removeEventListener('message', eventListener);
        }
    };

    return plugin;
}

/**
 * Creates a new plugin for form fields.
 * 
 * @param {object} options with the accepted origins.
 */
function SquidexFormField(options) {
    var context;
    var contextHandler;
    var currentConfirm;
    var currentPickAssets;
    var currentPickContents;
    var disabled = false;
    var disabledHandler;
    var formValue;
    var formValueHandler;
    var fullscreen = false;
    var fullscreenHandler
    var expanded = false;
    var expandedHandler;
    var index;
    var initCalled = false;
    var initHandler;
    var language;
    var languageHandler;
    var movedHandler;
    var timer;
    var value;
    var valueHandler;
    var acceptedOrigins = options && isArrayOfStrings(options.acceptedOrigins) ? options.acceptedOrigins : null;

    function raiseInit() {
        if (initHandler && !initCalled && context) {
            initHandler(context);
            initCalled = true;
        }
    }

    function raiseDisabled() {
        if (disabledHandler) {
            disabledHandler(disabled);
        }
    }

    function raiseExpanded() {
        if (expandedHandler) {
            expandedHandler(expanded);
        }
    }

    function raiseFullscreen() {
        if (fullscreenHandler) {
            fullscreenHandler(fullscreen);
        }
    }

    function raiseValueChanged() {
        if (valueHandler) {
            valueHandler(value);
        }
    }

    function raiseFormValueChanged() {
        if (formValueHandler && formValue) {
            formValueHandler(formValue);
        }
    }

    function raiseLanguageChanged() {
        if (languageHandler && isString(language)) {
            languageHandler(language);
        }
    }

    function raiseContextChanged() {
        if (contextHandler && context) {
            contextHandler(context);
        }
    }

    function raisedMoved() {
        if (movedHandler && isNumber(index)) {
            movedHandler(index);
        }
    }

    function eventListener(event) {
        if (acceptedOrigins && acceptedOrigins.indexOf(event.origin) < 0) {
            console.log('Origin not accepted: ' + event.origin);
            return;
        }

        if (event.source === window) {
            return;
        }
        
        var type = event.data.type;

        if (type === 'disabled') {
            var newDisabled = event.data.isDisabled;

            if (disabled !== newDisabled) {
                disabled = newDisabled;

                raiseDisabled();
            }
        } else if (type === 'moved') {
            var newIndex = event.data.index;

            if (index !== newIndex) {
                index = newIndex;

                raisedMoved();
            }
        } else if (type === 'languageChanged') {
            var newLanguage = event.data.language;

            if (language !== newLanguage) {
                language = newLanguage;

                raiseLanguageChanged();
            }
        } else if (type === 'valueChanged') {
            value = event.data.value;

            raiseValueChanged();
        } else if (type === 'formValueChanged') {
            formValue = event.data.formValue;

            raiseFormValueChanged();
        } else if (type === 'fullscreenChanged') {
            fullscreen = event.data.fullscreen;

            raiseFullscreen();
        } else if (type === 'expandedChanged') {
            expanded = event.data.expanded;

            raiseExpanded();
        } else if (type === 'init') {
            context = event.data.context;

            raiseInit();
        } else if (type === 'contextChanged') {
            context = event.data.context;

            raiseContextChanged();
        } else if (type === 'confirmResult') {
            var correlationId = event.data.correlationId;

            if (currentConfirm && currentConfirm.correlationId === correlationId) {
                if (typeof currentConfirm.callback === 'function') {
                    currentConfirm.callback(event.data.result);
                }
            }
        } else if (type === 'pickAssetsResult') {
            var correlationId = event.data.correlationId;

            if (currentPickAssets && currentPickAssets.correlationId === correlationId) {
                if (typeof currentPickAssets.callback === 'function') {
                    currentPickAssets.callback(event.data.result);
                }
            }
        } else if (type === 'pickContentsResult') {
            var correlationId = event.data.correlationId;

            if (currentPickContents && currentPickContents.correlationId === correlationId) {
                if (typeof currentPickContents.callback === 'function') {
                    currentPickContents.callback(event.data.result);
                }
            }
        }

        console.log('Received Message: ' + type);
    }

    window.addEventListener('message', eventListener, false);

    timer = measureAndNotifyParent();

    var plugin = {
        /**
         * Get the current value.
         */
        getValue: function () {
            return value;
        },

        /**
         * Get the current value.
         */
        getContext: function () {
            return context;
        },

        /**
         * Get the current form value.
         */
        getFormValue: function () {
            return formValue;
        },

        /**
         * Get the current field language.
         */
        getLanguage: function () {
            return language;
        },

        /**
         * Get the current index when the field is an array item. 
         */
        getIndex: function () {
            return index;
        },

        /**
         * Get the disabled state.
         */
        isDisabled: function () {
            return disabled;
        },

        /**
         * Get the fullscreen state.
         */
        isFullscreen: function () {
            return fullscreen;
        },

        /**
         * Get the expanded state.
         */
        isExpanded: function () {
            return expanded;
        },

        /**
         * Notifies the control container that the editor has been touched.
         */
        touched: function () {
            if (window.parent) {
                window.parent.postMessage({ type: 'touched' }, '*');
            }
        },

        /**
         * Notifies the parent to navigate to the path.
         *
         * @param {string} url: The url to navigate to.
         */
        navigate: function (url) {
            if (window.parent) {
                window.parent.postMessage({ type: 'navigate', url: url }, '*');
            }
        },

        /**
         * Notifies the parent to toggle the fullscreen mode.
         */
        toggleFullscreen: function () {
            if (window.parent) {
                window.parent.postMessage({ type: 'fullscreen', mode: !fullscreen }, '*');
            }
        },

        /**
         * Notifies the parent to toggle the expanded mode.
         */
        toggleExpanded: function () {
            if (window.parent) {
                window.parent.postMessage({ type: 'expanded', mode: !expanded }, '*');
            }
        },

        /**
         * Notifies the control container that the value has been changed.
         *
         * @param {any} newValue: The new field value.
         */
        valueChanged: function (newValue) {
            value = newValue;

            if (window.parent) {
                window.parent.postMessage({ type: 'valueChanged', value: newValue }, '*');
            }
        },

        /**
         * Shows an info alert.
         * 
         * @param {string} text: The info text.
         */
        notifyInfo: function (text) {
            if (window.parent) {
                window.parent.postMessage({ type: 'notifyInfo', text: text }, '*');
            }
        },

        /**
         * Shows an error alert.
         * 
         * @param {string} text: error info text.
         */
        notifyError: function (text) {
            if (window.parent) {
                window.parent.postMessage({ type: 'notifyError', text: text }, '*');
            }
        },

        /**
         * Shows an confirm dialog.
         * 
         * @param {string} title The title of the dialog.
         * @param {string} text The text of the dialog.
         * @param {function} callback The callback to invoke when the dialog is completed or closed.
         */
        confirm: function (title, text, callback) {
            if (!isFunction(callback)) {
                return;
            }

            var correlationId = new Date().getTime().toString();

            currentConfirm = { correlationId: correlationId, callback: callback };

            if (window.parent) {
                window.parent.postMessage({ type: 'confirm', title: title, text: text, correlationId: correlationId }, '*');
            }
        },

        /**
         * Shows the dialog to pick assets.
         * 
         * @param {function} callback The callback to invoke when the dialog is completed or closed.
         */
        pickAssets: function (callback) {
            if (!isFunction(callback)) {
                return;
            }

            var correlationId = new Date().getTime().toString();

            currentPickAssets = { correlationId: correlationId, callback: callback };

            if (window.parent) {
                window.parent.postMessage({ type: 'pickAssets', correlationId: correlationId }, '*');
            }
        },

        /**
         * Shows the dialog to pick assets.
         * 
         * @param {string[]} schemas: The list of schema names.
         * @param {function} callback The callback to invoke when the dialog is completed or closed.
         * @param {string} query: The initial filter that is used in the UI.
         * @param {string[]} selectedIds: The selected ids to mark them as selected in the content selector dialog.
         */
        pickContents: function (schemas, callback, query, selectedIds) {
            if (!isFunction(callback)) {
                return;
            }

            var correlationId = new Date().getTime().toString();

            currentPickContents = { correlationId: correlationId, callback: callback };

            if (window.parent) {
                window.parent.postMessage({ type: 'pickContents', correlationId: correlationId, schemas: schemas, query: query, selectedIds: selectedIds }, '*');
            }
        },

        /**
         * Shows a dialog to pick a file.
         */
        pickFile: function () {
            if (window.parent) {
                window.parent.postMessage({ type: 'pickFile' }, '*');
            }
        },

        /**
         * Register an function that is called when the field is initialized.
         * 
         * @param {function} callback: The callback to invoke.
         */
        onInit: function (callback) {
            if (!isFunction(callback)) {
                return;
            }

            initHandler = callback;
            raiseInit();
        },

        /**
         * Register an function that is called when the field is moved.
         *
         * @param {function} callback: The callback to invoke. Argument 1: New position (number).
         */
        onMoved: function (callback) {
            if (!isFunction(callback)) {
                return;
            }

            movedHandler = callback;

            raisedMoved();
        },

        /**
         * Register an function that is called whenever the field is disabled or enabled.
         *
         * @param {function} callback: The callback to invoke. Argument 1: New disabled state (boolean, disabled = true, enabled = false).
         */
        onDisabled: function (callback) {
            if (!isFunction(callback)) {
                return;
            }

            disabledHandler = callback;
            raiseDisabled();
        },

        /**
         * Register an function that is called whenever the context has been changed.
         *
         * @param {function} callback: The callback to invoke. Argument 1: New context.
         */
        onContextChanged: function (callback) {
            if (!isFunction(callback)) {
                return;
            }

            contextHandler = callback;
            raiseContextChanged();
        },

        /**
         * Register an function that is called whenever the field language is changed.
         *
         * @param {function} callback: The callback to invoke. Argument 1: Language code (string).
         */
        onLanguageChanged: function (callback) {
            if (!isFunction(callback)) {
                return;
            }

            languageHandler = callback;
            raiseLanguageChanged();
        },

        /**
         * Register an function that is called whenever the value of the field has changed.
         *
         * @param {function} callback: The callback to invoke. Argument 1: Field value (any).
         */
        onValueChanged: function (callback) {
            if (!isFunction(callback)) {
                return;
            }

            valueHandler = callback;
            raiseValueChanged();
        },

        /**
         * Register an function that is called whenever the value of the content has changed.
         *
         * @param {function} callback: The callback to invoke. Argument 1: Content value (any).
         */
        onFormValueChanged: function (callback) {
            if (!isFunction(callback)) {
                return;
            }

            formValueHandler = callback;
            raiseFormValueChanged();
        },

        /**
         * Register an function that is called whenever the fullscreen mode has changed.
         *
         * @param {function} callback: The callback to invoke. Argument 1: Fullscreen state (boolean, fullscreen on = true, fullscreen off = false).
         */
        onFullscreen: function (callback) {
            if (!isFunction(callback)) {
                return;
            }

            fullscreenHandler = callback;
            raiseFullscreen();
        },

        /**
         * Register an function that is called whenever the expanded mode has changed.
         *
         * @param {function} callback: The callback to invoke. Argument 1: Expanded state (boolean, expanded on = true, expanded off = false).
         */
        onExpanded: function (callback) {
            if (!isFunction(callback)) {
                return;
            }

            expandedHandler = callback;
            raiseExpanded();
        },

        /**
         * Clean the editor SDK.
         */
        clean: function () {
            window.removeEventListener('message', eventListener);

            if (timer) {
                timer();
            }
        }
    };

    return plugin;
};