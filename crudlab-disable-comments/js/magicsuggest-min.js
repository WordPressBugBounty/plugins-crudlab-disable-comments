(function($) {
    "use strict";
    var MagicSuggest = function(element, options) {
        var ms = this;
        var defaults = {
            allowFreeEntries: true,
            cls: "",
            data: null,
            dataUrlParams: {},
            disabled: false,
            displayField: "name",
            editable: true,
            expanded: false,
            expandOnFocus: false,
            groupBy: null,
            hideTrigger: false,
            highlight: true,
            id: null,
            infoMsgCls: "",
            inputCfg: {},
            invalidCls: "ms-inv",
            matchCase: false,
            maxDropHeight: 290,
            maxEntryLength: null,
            maxEntryRenderer: function(v) {
                return "Please reduce your entry by " + v + " character" + (v > 1 ? "s" : "")
            },
            maxSuggestions: null,
            maxSelection: 10,
            maxSelectionRenderer: function(v) {
                return "You cannot choose more than " + v + " item" + (v > 1 ? "s" : "")
            },
            method: "POST",
            minChars: 0,
            minCharsRenderer: function(v) {
                return "Please type " + v + " more character" + (v > 1 ? "s" : "")
            },
            mode: "local",
            name: null,
            noSuggestionText: "No suggestions",
            placeholder: "Type or click here",
            autoSelect: true,
            renderer: null,
            required: false,
            resultAsString: false,
            resultsField: "results",
            selectionCls: "",
            selectionPosition: "inner",
            selectionRenderer: null,
            selectionStacked: false,
            sortDir: "asc",
            sortOrder: null,
            strictSuggest: false,
            style: "",
            toggleOnClick: false,
            typeDelay: 400,
            useTabKey: false,
            useCommaKey: true,
            useZebraStyle: false,
            value: null,
            valueField: "id"
        };
        var conf = $.extend({}, options);
        var cfg = $.extend(true, {}, defaults, conf);
        this.addToSelection = function(items, isSilent) {
            if (!cfg.maxSelection || _selection.length < cfg.maxSelection) {
                if (!$.isArray(items)) {
                    items = [items]
                }
                var valuechanged = false;
                $.each(items, function(index, json) {
                    if ($.inArray(json[cfg.valueField], ms.getValue()) === -1) {
                        _selection.push(json);
                        valuechanged = true
                    }
                });
                if (valuechanged === true) {
                    self._renderSelection();
                    this.empty();
                    if (isSilent !== true) {
                        $(this).trigger("selectionchange", [this, this.getSelection()])
                    }
                }
            }
            this.input.attr("placeholder", cfg.selectionPosition === "inner" && this.getValue().length > 0 ? "" : cfg.placeholder)
        };
        this.clear = function(isSilent) {
            this.removeFromSelection(_selection.slice(0), isSilent)
        };
        this.collapse = function() {
            if (cfg.expanded === true) {
                this.combobox.detach();
                cfg.expanded = false;
                $(this).trigger("collapse", [this])
            }
        };
        this.disable = function() {
            this.container.addClass("ms-ctn-disabled");
            cfg.disabled = true;
            ms.input.attr("disabled", true)
        };
        this.empty = function() {
            this.input.val("")
        };
        this.enable = function() {
            this.container.removeClass("ms-ctn-disabled");
            cfg.disabled = false;
            ms.input.attr("disabled", false)
        };
        this.expand = function() {
            if (!cfg.expanded && (this.input.val().length >= cfg.minChars || this.combobox.children().size() > 0)) {
                this.combobox.appendTo(this.container);
                self._processSuggestions();
                cfg.expanded = true;
                $(this).trigger("expand", [this])
            }
        };
        this.isDisabled = function() {
            return cfg.disabled
        };
        this.isValid = function() {
            return cfg.required === false || _selection.length > 0
        };
        this.getDataUrlParams = function() {
            return cfg.dataUrlParams
        };
        this.getName = function() {
            return cfg.name
        };
        this.getSelection = function() {
            return _selection
        };
        this.getRawValue = function() {
            return ms.input.val()
        };
        this.getValue = function() {
            return $.map(_selection, function(o) {
                return o[cfg.valueField]
            })
        };
        this.removeFromSelection = function(items, isSilent) {
            if (!$.isArray(items)) {
                items = [items]
            }
            var valuechanged = false;
            $.each(items, function(index, json) {
                var i = $.inArray(json[cfg.valueField], ms.getValue());
                if (i > -1) {
                    _selection.splice(i, 1);
                    valuechanged = true
                }
            });
            if (valuechanged === true) {
                self._renderSelection();
                if (isSilent !== true) {
                    $(this).trigger("selectionchange", [this, this.getSelection()])
                }
                if (cfg.expandOnFocus) {
                    ms.expand()
                }
                if (cfg.expanded) {
                    self._processSuggestions()
                }
            }
            this.input.attr("placeholder", cfg.selectionPosition === "inner" && this.getValue().length > 0 ? "" : cfg.placeholder)
        };
        this.getData = function() {
            return cfg.data
        };
        this.setData = function(data) {
            cfg.data = data;
            self._processSuggestions()
        };
        this.setName = function(name) {
            cfg.name = name;
            if (name) {
                cfg.name += name.indexOf("[]") > 0 ? "" : "[]"
            }
            if (ms._valueContainer) {
                $.each(ms._valueContainer.children(), function(i, el) {
                    el.name = cfg.name
                })
            }
        };
        this.setSelection = function(items) {
            this.clear();
            this.addToSelection(items)
        };
        this.setValue = function(values) {
            var items = [];
            $.each(values, function(index, value) {
                var found = false;
                $.each(_cbData, function(i, item) {
                    if (item[cfg.valueField] == value) {
                        items.push(item);
                        found = true;
                        return false
                    }
                });
                if (!found) {
                    if (typeof value === "object") {
                        items.push(value)
                    } else {
                        var json = {};
                        json[cfg.valueField] = value;
                        json[cfg.displayField] = value;
                        items.push(json)
                    }
                }
            });
            if (items.length > 0) {
                this.addToSelection(items)
            }
        };
        this.setDataUrlParams = function(params) {
            cfg.dataUrlParams = $.extend({}, params)
        };
        var _selection = [],
            _comboItemHeight = 0,
            _timer, _hasFocus = false,
            _groups = null,
            _cbData = [],
            _ctrlDown = false;
        var self = {
            _displaySuggestions: function(data) {
                ms.combobox.show();
                ms.combobox.empty();
                var resHeight = 0,
                    nbGroups = 0;
                if (_groups === null) {
                    self._renderComboItems(data);
                    resHeight = _comboItemHeight * data.length
                } else {
                    for (var grpName in _groups) {
                        nbGroups += 1;
                        $("<div/>", {
                            "class": "ms-res-group",
                            html: grpName
                        }).appendTo(ms.combobox);
                        self._renderComboItems(_groups[grpName].items, true)
                    }
                    resHeight = _comboItemHeight * (data.length + nbGroups)
                }
                if (resHeight < ms.combobox.height() || resHeight <= cfg.maxDropHeight) {
                    ms.combobox.height(resHeight)
                } else if (resHeight >= ms.combobox.height() && resHeight > cfg.maxDropHeight) {
                    ms.combobox.height(cfg.maxDropHeight)
                }
                if (data.length === 1 && cfg.autoSelect === true) {
                    ms.combobox.children().filter(":last").addClass("ms-res-item-active")
                }
                if (data.length === 0 && ms.getRawValue() !== "") {
                    self._updateHelper(cfg.noSuggestionText);
                    ms.collapse()
                }
                if (data.length === 0) {
                    ms.combobox.hide()
                }
            },
            _getEntriesFromStringArray: function(data) {
                var json = [];
                $.each(data, function(index, s) {
                    var entry = {};
                    entry[cfg.displayField] = entry[cfg.valueField] = $.trim(s);
                    json.push(entry)
                });
                return json
            },
            _highlightSuggestion: function(html) {
                var q = ms.input.val();
                if (q.length === 0) {
                    return html
                }
                if (cfg.matchCase === true) {
                    html = html.replace(new RegExp("(" + q + ")(?!([^<]+)?>)", "g"), "<em>$1</em>")
                } else {
                    html = html.replace(new RegExp("(" + q + ")(?!([^<]+)?>)", "gi"), "<em>$1</em>")
                }
                return html
            },
            _moveSelectedRow: function(dir) {
                if (!cfg.expanded) {
                    ms.expand()
                }
                var list, start, active, scrollPos;
                list = ms.combobox.find(".ms-res-item");
                if (dir === "down") {
                    start = list.eq(0)
                } else {
                    start = list.filter(":last")
                }
                active = ms.combobox.find(".ms-res-item-active:first");
                if (active.length > 0) {
                    if (dir === "down") {
                        start = active.nextAll(".ms-res-item").first();
                        if (start.length === 0) {
                            start = list.eq(0)
                        }
                        scrollPos = ms.combobox.scrollTop();
                        ms.combobox.scrollTop(0);
                        if (start[0].offsetTop + start.outerHeight() > ms.combobox.height()) {
                            ms.combobox.scrollTop(scrollPos + _comboItemHeight)
                        }
                    } else {
                        start = active.prevAll(".ms-res-item").first();
                        if (start.length === 0) {
                            start = list.filter(":last");
                            ms.combobox.scrollTop(_comboItemHeight * list.length)
                        }
                        if (start[0].offsetTop < ms.combobox.scrollTop()) {
                            ms.combobox.scrollTop(ms.combobox.scrollTop() - _comboItemHeight)
                        }
                    }
                }
                list.removeClass("ms-res-item-active");
                start.addClass("ms-res-item-active")
            },
            _processSuggestions: function(source) {
                var json = null,
                    data = source || cfg.data;
                if (data !== null) {
                    if (typeof data === "function") {
                        data = data.call(ms)
                    }
                    if (typeof data === "string") {
                        $(ms).trigger("beforeload", [ms]);
                        var params = $.extend({
                            query: ms.input.val()
                        }, cfg.dataUrlParams);
                        $.ajax({
                            type: cfg.method,
                            url: data,
                            data: params,
                            success: function(asyncData) {
                                json = typeof asyncData === "string" ? JSON.parse(asyncData) : asyncData;
                                self._processSuggestions(json);
                                $(ms).trigger("load", [ms, json]);
                                if (self._asyncValues) {
                                    ms.setValue(typeof self._asyncValues === "string" ? JSON.parse(self._asyncValues) : self._asyncValues);
                                    self._renderSelection();
                                    delete self._asyncValues
                                }
                            },
                            error: function() {
                                throw "Could not reach server"
                            }
                        });
                        return
                    } else {
                        if (data.length > 0 && typeof data[0] === "string") {
                            _cbData = self._getEntriesFromStringArray(data)
                        } else {
                            _cbData = data[cfg.resultsField] || data
                        }
                    }
                    var sortedData = cfg.mode === "remote" ? _cbData : self._sortAndTrim(_cbData);
                    self._displaySuggestions(self._group(sortedData))
                }
            },
            _render: function(el) {
                ms.setName(cfg.name);
                ms.container = $("<div/>", {
                    "class": "ms-ctn form-control " + (cfg.resultAsString ? "ms-as-string " : "") + cfg.cls + (cfg.disabled === true ? " ms-ctn-disabled" : "") + (cfg.editable === true ? "" : " ms-ctn-readonly") + (cfg.hideTrigger === false ? "" : " ms-no-trigger"),
                    style: cfg.style
                });
                ms.container.focus($.proxy(handlers._onFocus, this));
                ms.container.blur($.proxy(handlers._onBlur, this));
                ms.container.keydown($.proxy(handlers._onKeyDown, this));
                ms.container.keyup($.proxy(handlers._onKeyUp, this));
                ms.input = $("<input/>", $.extend({
                    type: "text",
                    "class": cfg.editable === true ? "" : " ms-input-readonly",
                    readonly: !cfg.editable,
                    placeholder: cfg.placeholder,
                    disabled: cfg.disabled
                }, cfg.inputCfg));
                ms.input.focus($.proxy(handlers._onInputFocus, this));
                ms.input.click($.proxy(handlers._onInputClick, this));
                ms.combobox = $("<div/>", {
                    "class": "ms-res-ctn dropdown-menu"
                }).height(cfg.maxDropHeight);
                ms.combobox.on("click", "div.ms-res-item", $.proxy(handlers._onComboItemSelected, this));
                ms.combobox.on("mouseover", "div.ms-res-item", $.proxy(handlers._onComboItemMouseOver, this));
                ms.selectionContainer = $("<div/>", {
                    "class": "ms-sel-ctn"
                });
                ms.selectionContainer.click($.proxy(handlers._onFocus, this));
                if (cfg.selectionPosition === "inner") {
                    ms.selectionContainer.append(ms.input)
                } else {
                    ms.container.append(ms.input)
                }
                ms.helper = $("<span/>", {
                    "class": "ms-helper " + cfg.infoMsgCls
                });
                self._updateHelper();
                ms.container.append(ms.helper);
                $(el).replaceWith(ms.container);
                switch (cfg.selectionPosition) {
                    case "bottom":
                        ms.selectionContainer.insertAfter(ms.container);
                        if (cfg.selectionStacked === true) {
                            ms.selectionContainer.width(ms.container.width());
                            ms.selectionContainer.addClass("ms-stacked")
                        }
                        break;
                    case "right":
                        ms.selectionContainer.insertAfter(ms.container);
                        ms.container.css("float", "left");
                        break;
                    default:
                        ms.container.append(ms.selectionContainer);
                        break
                }
                if (cfg.hideTrigger === false) {
                    ms.trigger = $("<div/>", {
                        "class": "ms-trigger",
                        html: '<div class="ms-trigger-ico"></div>'
                    });
                    ms.trigger.click($.proxy(handlers._onTriggerClick, this));
                    ms.container.append(ms.trigger)
                }
                if (cfg.value !== null) {
                    if (typeof cfg.data === "string") {
                        self._asyncValues = cfg.value;
                        self._processSuggestions()
                    } else {
                        self._processSuggestions();
                        ms.setValue(cfg.value);
                        self._renderSelection()
                    }
                }
                $("body").click(function(e) {
                    if (ms.container.hasClass("ms-ctn-focus") && ms.container.has(e.target).length === 0 && e.target.className.indexOf("ms-res-item") < 0 && e.target.className.indexOf("ms-close-btn") < 0 && ms.container[0] !== e.target) {
                        handlers._onBlur()
                    }
                });
                if (cfg.expanded === true) {
                    cfg.expanded = false;
                    ms.expand()
                }
            },
            _renderComboItems: function(items, isGrouped) {
                var ref = this,
                    html = "";
                $.each(items, function(index, value) {
                    var displayed = cfg.renderer !== null ? cfg.renderer.call(ref, value) : value[cfg.displayField];
                    var resultItemEl = $("<div/>", {
                        "class": "ms-res-item " + (isGrouped ? "ms-res-item-grouped " : "") + (index % 2 === 1 && cfg.useZebraStyle === true ? "ms-res-odd" : ""),
                        html: cfg.highlight === true ? self._highlightSuggestion(displayed) : displayed,
                        "data-json": JSON.stringify(value)
                    });
                    resultItemEl.click($.proxy(handlers._onComboItemSelected, ref));
                    resultItemEl.mouseover($.proxy(handlers._onComboItemMouseOver, ref));
                    html += $("<div/>").append(resultItemEl).html()
                });
                ms.combobox.append(html);
                _comboItemHeight = ms.combobox.find(".ms-res-item:first").outerHeight()
            },
            _renderSelection: function() {
                var ref = this,
                    w = 0,
                    inputOffset = 0,
                    items = [],
                    asText = cfg.resultAsString === true && !_hasFocus;
                ms.selectionContainer.find(".ms-sel-item").remove();
                if (ms._valueContainer !== undefined) {
                    ms._valueContainer.remove()
                }
                $.each(_selection, function(index, value) {
                    var selectedItemEl, delItemEl, selectedItemHtml = cfg.selectionRenderer !== null ? cfg.selectionRenderer.call(ref, value) : value[cfg.displayField];
                    if (asText === true) {
                        selectedItemEl = $("<div/>", {
                            "class": "ms-sel-item ms-sel-text " + cfg.selectionCls,
                            html: selectedItemHtml + (index === _selection.length - 1 ? "" : ",")
                        }).data("json", value)
                    } else {
                        selectedItemEl = $("<div/>", {
                            "class": "ms-sel-item " + cfg.selectionCls,
                            html: selectedItemHtml
                        }).data("json", value);
                        if (cfg.disabled === false) {
                            delItemEl = $("<span/>", {
                                "class": "ms-close-btn"
                            }).data("json", value).appendTo(selectedItemEl);
                            delItemEl.click($.proxy(handlers._onTagTriggerClick, ref))
                        }
                    }
                    items.push(selectedItemEl)
                });
                ms.selectionContainer.prepend(items);
                ms._valueContainer = $("<div/>", {
                    style: "display: none;"
                });
                $.each(ms.getValue(), function(i, val) {
                    var el = $("<input/>", {
                        type: "hidden",
                        name: cfg.name,
                        value: val
                    });
                    el.appendTo(ms._valueContainer)
                });
                ms._valueContainer.appendTo(ms.selectionContainer);
                if (cfg.selectionPosition === "inner") {
                    ms.input.width(0);
                    inputOffset = ms.input.offset().left - ms.selectionContainer.offset().left;
                    w = ms.container.width() - inputOffset - 42;
                    if(ms.getValue()==""){w="100%";} 
                    ms.input.width(w)
                }
                if (_selection.length === cfg.maxSelection) {
                    self._updateHelper(cfg.maxSelectionRenderer.call(this, _selection.length))
                } else {
                    ms.helper.hide()
                }
            },
            _selectItem: function(item) {
                if (cfg.maxSelection === 1) {
                    _selection = []
                }
                ms.addToSelection(item.data("json"));
                item.removeClass("ms-res-item-active");
                if (cfg.expandOnFocus === false || _selection.length === cfg.maxSelection) {
                    ms.collapse()
                }
                if (!_hasFocus) {
                    ms.input.focus()
                } else if (_hasFocus && (cfg.expandOnFocus || _ctrlDown)) {
                    self._processSuggestions();
                    if (_ctrlDown) {
                        ms.expand()
                    }
                }
            },
            _sortAndTrim: function(data) {
                var q = ms.getRawValue(),
                    filtered = [],
                    newSuggestions = [],
                    selectedValues = ms.getValue();
                if (q.length > 0) {
                    $.each(data, function(index, obj) {
                        var name = obj[cfg.displayField];
                        if (cfg.matchCase === true && name.indexOf(q) > -1 || cfg.matchCase === false && name.toLowerCase().indexOf(q.toLowerCase()) > -1) {
                            if (cfg.strictSuggest === false || name.toLowerCase().indexOf(q.toLowerCase()) === 0) {
                                filtered.push(obj)
                            }
                        }
                    })
                } else {
                    filtered = data
                }
                $.each(filtered, function(index, obj) {
                    if ($.inArray(obj[cfg.valueField], selectedValues) === -1) {
                        newSuggestions.push(obj)
                    }
                });
                if (cfg.sortOrder !== null) {
                    newSuggestions.sort(function(a, b) {
                        if (a[cfg.sortOrder] < b[cfg.sortOrder]) {
                            return cfg.sortDir === "asc" ? -1 : 1
                        }
                        if (a[cfg.sortOrder] > b[cfg.sortOrder]) {
                            return cfg.sortDir === "asc" ? 1 : -1
                        }
                        return 0
                    })
                }
                if (cfg.maxSuggestions && cfg.maxSuggestions > 0) {
                    newSuggestions = newSuggestions.slice(0, cfg.maxSuggestions)
                }
                return newSuggestions
            },
            _group: function(data) {
                if (cfg.groupBy !== null) {
                    _groups = {};
                    $.each(data, function(index, value) {
                        if (_groups[value[cfg.groupBy]] === undefined) {
                            _groups[value[cfg.groupBy]] = {
                                title: value[cfg.groupBy],
                                items: [value]
                            }
                        } else {
                            _groups[value[cfg.groupBy]].items.push(value)
                        }
                    })
                }
                return data
            },
            _updateHelper: function(html) {
                ms.helper.html(html);
                if (!ms.helper.is(":visible")) {
                    ms.helper.fadeIn()
                }
            }
        };
        var handlers = {
            _onBlur: function() {
                ms.container.removeClass("ms-ctn-focus");
                ms.collapse();
                _hasFocus = false;
                if (ms.getRawValue() !== "" && cfg.allowFreeEntries === true) {
                    var obj = {};
                    obj[cfg.displayField] = obj[cfg.valueField] = ms.getRawValue().trim();
                    ms.addToSelection(obj)
                }
                self._renderSelection();
                if (ms.isValid() === false) {
                    ms.container.addClass(cfg.invalidCls)
                } else if (ms.input.val() !== "" && cfg.allowFreeEntries === false) {
                    ms.empty();
                    self._updateHelper("")
                }
                $(ms).trigger("blur", [ms])
            },
            _onComboItemMouseOver: function(e) {
                ms.combobox.children().removeClass("ms-res-item-active");
                $(e.currentTarget).addClass("ms-res-item-active")
            },
            _onComboItemSelected: function(e) {
                self._selectItem($(e.currentTarget))
            },
            _onFocus: function() {
                ms.input.focus()
            },
            _onInputClick: function() {
                if (ms.isDisabled() === false && _hasFocus) {
                    if (cfg.toggleOnClick === true) {
                        if (cfg.expanded) {
                            ms.collapse()
                        } else {
                            ms.expand()
                        }
                    }
                }
            },
            _onInputFocus: function() {
                if (ms.isDisabled() === false && !_hasFocus) {
                    _hasFocus = true;
                    ms.container.addClass("ms-ctn-focus");
                    ms.container.removeClass(cfg.invalidCls);
                    var curLength = ms.getRawValue().length;
                    if (cfg.expandOnFocus === true) {
                        ms.expand()
                    }
                    if (_selection.length === cfg.maxSelection) {
                        self._updateHelper(cfg.maxSelectionRenderer.call(this, _selection.length))
                    } else if (curLength < cfg.minChars) {
                        self._updateHelper(cfg.minCharsRenderer.call(this, cfg.minChars - curLength))
                    }
                    self._renderSelection();
                    $(ms).trigger("focus", [ms])
                }
            },
            _onKeyDown: function(e) {
                var active = ms.combobox.find(".ms-res-item-active:first"),
                    freeInput = ms.input.val();
                $(ms).trigger("keydown", [ms, e]);
                if (e.keyCode === 9 && (cfg.useTabKey === false || cfg.useTabKey === true && active.length === 0 && ms.input.val().length === 0)) {
                    handlers._onBlur();
                    return
                }
                switch (e.keyCode) {
                    case 8:
                        if (freeInput.length === 0 && ms.getSelection().length > 0 && cfg.selectionPosition === "inner") {
                            _selection.pop();
                            self._renderSelection();
                            $(ms).trigger("selectionchange", [ms, ms.getSelection()]);
                            ms.input.attr("placeholder", cfg.selectionPosition === "inner" && this.getValue().length > 0 ? "" : cfg.placeholder);
                            ms.input.focus();
                            e.preventDefault()
                        }
                        break;
                    case 9:
                    case 188:
                    case 13:
                        e.preventDefault();
                        break;
                    case 17:
                        _ctrlDown = true;
                        break;
                    case 40:
                        e.preventDefault();
                        self._moveSelectedRow("down");
                        break;
                    case 38:
                        e.preventDefault();
                        self._moveSelectedRow("up");
                        break;
                    default:
                        if (_selection.length === cfg.maxSelection) {
                            e.preventDefault()
                        }
                        break
                }
            },
            _onKeyUp: function(e) {
                var freeInput = ms.getRawValue(),
                    inputValid = $.trim(ms.input.val()).length > 0 && (!cfg.maxEntryLength || $.trim(ms.input.val()).length <= cfg.maxEntryLength),
                    selected, obj = {};
                $(ms).trigger("keyup", [ms, e]);
                clearTimeout(_timer);
                if (e.keyCode === 27 && cfg.expanded) {
                    ms.combobox.hide()
                }
                if (e.keyCode === 9 && cfg.useTabKey === false || e.keyCode > 13 && e.keyCode < 32) {
                    if (e.keyCode === 17) {
                        _ctrlDown = false
                    }
                    return
                }
                switch (e.keyCode) {
                    case 40:
                    case 38:
                        e.preventDefault();
                        break;
                    case 13:
                    case 9:
                    case 188:
                        if (e.keyCode !== 188 || cfg.useCommaKey === true) {
                            e.preventDefault();
                            if (cfg.expanded === true) {
                                selected = ms.combobox.find(".ms-res-item-active:first");
                                if (selected.length > 0) {
                                    self._selectItem(selected);
                                    return
                                }
                            }
                            if (inputValid === true && cfg.allowFreeEntries === true) {
                                obj[cfg.displayField] = obj[cfg.valueField] = freeInput.trim();
                                ms.addToSelection(obj);
                                ms.collapse();
                                ms.input.focus()
                            }
                            break
                        }
                    default:
                        if (_selection.length === cfg.maxSelection) {
                            self._updateHelper(cfg.maxSelectionRenderer.call(this, _selection.length))
                        } else {
                            if (freeInput.length < cfg.minChars) {
                                self._updateHelper(cfg.minCharsRenderer.call(this, cfg.minChars - freeInput.length));
                                if (cfg.expanded === true) {
                                    ms.collapse()
                                }
                            } else if (cfg.maxEntryLength && freeInput.length > cfg.maxEntryLength) {
                                self._updateHelper(cfg.maxEntryRenderer.call(this, freeInput.length - cfg.maxEntryLength));
                                if (cfg.expanded === true) {
                                    ms.collapse()
                                }
                            } else {
                                ms.helper.hide();
                                if (cfg.minChars <= freeInput.length) {
                                    _timer = setTimeout(function() {
                                        if (cfg.expanded === true) {
                                            self._processSuggestions()
                                        } else {
                                            ms.expand()
                                        }
                                    }, cfg.typeDelay)
                                }
                            }
                        }
                        break
                }
            },
            _onTagTriggerClick: function(e) {
                ms.removeFromSelection($(e.currentTarget).data("json"))
            },
            _onTriggerClick: function() {
                if (ms.isDisabled() === false && !(cfg.expandOnFocus === true && _selection.length === cfg.maxSelection)) {
                    $(ms).trigger("triggerclick", [ms]);
                    if (cfg.expanded === true) {
                        ms.collapse()
                    } else {
                        var curLength = ms.getRawValue().length;
                        if (curLength >= cfg.minChars) {
                            ms.input.focus();
                            ms.expand()
                        } else {
                            self._updateHelper(cfg.minCharsRenderer.call(this, cfg.minChars - curLength))
                        }
                    }
                }
            }
        };
        if (element !== null) {
            self._render(element)
        }
    };
    $.fn.magicSuggest = function(options) {
        var obj = $(this);
        if (obj.size() === 1 && obj.data("magicSuggest")) {
            return obj.data("magicSuggest")
        }
        obj.each(function(i) {
            var cntr = $(this);
            if (cntr.data("magicSuggest")) {
                return
            }
            if (this.nodeName.toLowerCase() === "select") {
                options.data = [];
                options.value = [];
                $.each(this.children, function(index, child) {
                    if (child.nodeName && child.nodeName.toLowerCase() === "option") {
                        options.data.push({
                            id: child.value,
                            name: child.text
                        });
                        if (child.selected) {
                            options.value.push(child.value)
                        }
                    }
                })
            }
            var def = {};
            $.each(this.attributes, function(i, att) {
                def[att.name] = att.value
            });
            var field = new MagicSuggest(this, $.extend([], $.fn.magicSuggest.defaults, options, def));
            cntr.data("magicSuggest", field);
            field.container.data("magicSuggest", field)
        });
        if (obj.size() === 1) {
            return obj.data("magicSuggest")
        }
        return obj
    };
    $.fn.magicSuggest.defaults = {}
})(jQuery);