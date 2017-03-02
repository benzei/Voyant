Ext.define('Voyant.widget.QuerySearchField', {
    extend: 'Ext.form.field.Tag',
    mixins: ['Voyant.util.Localization'],
    alias: 'widget.querysearchfield',
	statics: {
		i18n: {
		}
	},
	config: {
		corpus: undefined,
		tokenType: 'lexical',
		isDocsMode: false,
		inDocumentsCountOnly: undefined,
		stopList: undefined,
		showAggregateInDocumentsCount: false
	},
	hasCorpusLoadedListener: false, 
    
    constructor: function(config) {
    	config = config || {};
    	var itemTpl = config.itemTpl ? config.itemTpl : '{term} ({'+(config.inDocumentsCountOnly ? 'inDocumentsCount' : 'rawFreq')+'})';
    	Ext.applyIf(config, {
    		minWidth: 100,
    		maxWidth: 200,
    		matchFieldWidth : false,
    		minChars: 2,
    	    displayField: 'term',
    	    valueField: 'term',
    	    filterPickList: true,
    	    createNewOnEnter: true,
    	    createNewOnBlur: false,
    	    autoSelect: false,
//    	    emptyText: this.localize('querySearch'),
    	    tpl: [
    	    	'<ul class="x-list-plain"><tpl for=".">',
    	    	'<li role="option" class="x-boundlist-item" style="white-space: nowrap;">'+itemTpl+'</li>',
    	    	'</tpl></ul>'
    	    ],
    	    triggers: {
    	        help: {
    	            weight: 2,
    	            cls: 'fa-trigger form-fa-help-trigger',
    	            handler: function() {
    	            	Ext.Msg.show({
    	            	    title: this.localize('querySearch'),
    	            	    message: this.getIsDocsMode() ? this.localize('querySearchDocsModeTip') : this.localize('querySearchTip'),
    	            	    buttons: Ext.OK,
    	            	    icon: Ext.Msg.INFO
    	            	});
    	            },
    	            scope: 'this'
    	        }
    	   }
    	})
    	if (config.showAggregateInDocumentsCount) {
    		config.triggers.count = {
	            cls: 'fa-trigger',
	            handler: 'onHelpClick',
	            scope: 'this',
	            hidden: true
    		}
    	}
        this.callParent(arguments);
    },
    initComponent: function(config) {
    	var me = this;

    	me.on("beforequery", function(queryPlan) {
    		if (queryPlan.query) {
    			queryPlan.query = queryPlan.query.trim();
    			if (queryPlan.query.charAt(0)=="^") {
    				queryPlan.query=queryPlan.query.substring(1)
    				queryPlan.cancel = queryPlan.query.length==0; // cancel if it's just that character
    			}
    			if (queryPlan.query.charAt(0)=="*") { // convert leading wildcard to regex
    				queryPlan.query = "."+queryPlan.query;
    			}
    			if (queryPlan.query.charAt(queryPlan.query.length-1)=='*') {
    				queryPlan.query=queryPlan.query.substring(0,queryPlan.query.length-1)
    				queryPlan.cancel = queryPlan.query.length==0; // cancel if it's just that character
    			}
    			if (queryPlan.query.charAt(0)==".") {
    				queryPlan.cancel = queryPlan.query.length< (/\W/.test(queryPlan.query.charAt(1)) ? 5 : 4) // cancel if we only have 3 or fewer after .
    			}
    			try {
                    new RegExp(queryPlan.query);
	            }
	            catch(e) {
	            	queryPlan.cancel = true;
	            }
	            if (queryPlan.query.indexOf('"')>-1) { // deal with unfinished phrases
	            	if (queryPlan.query.indexOf(" ")==-1) {queryPlan.cancel=true} // no space in phrase
	            	if ((queryPlan.query.match(/"/) || []).length!=2) {queryPlan.cancel=true;} // not balanced quotes
	            }
	            if (queryPlan.query.indexOf("*")>-1) {
	            	if (queryPlan.query.indexOf(" ")==-1) {
	            		queryPlan.query += ",^"+queryPlan.query;
	            	}
	            } else {
	            	queryPlan.query = queryPlan.query+"*"+ (queryPlan.query.indexOf(" ")==-1 ? ","+"^"+queryPlan.query+"*" : "")
	            }
    		}
    	});
    	
    	me.on("change", function(tags, queries) {
    		queries = queries.map(function(query) {return query.replace(/^(\^?)\*/, "$1.*")});
    		me.up('panel').fireEvent("query", me, queries);
    		if (me.triggers.count) {
    			me.triggers.count.show();
    			me.triggers.count.getEl().setHtml('0');
    			if (queries.length>0) {
    				me.getCorpus().getCorpusTerms().load({
    					params: {
    						query: queries.map(function(q) {return '('+q+')'}).join("|"),
			    			tokenType: me.getTokenType(),
			    			stopList: me.getStopList(),
			    			inDocumentsCountOnly: true
    					},
    					callback: function(records, operation, success) {
    						if (success && records && records.length==1) {
    							me.triggers.count.getEl().setHtml(records[0].getInDocumentsCount())
    						}
    					}
    				})
    			} else {
    				me.triggers.count.hide();
    			}
    		}
    	})

    	// we need to make sure the panel is a voyantpanel
    	// so that we get loadedCorpus event after a call to Voyant.util.Toolable.replacePanel
    	var parentPanel = me.up('panel:mixin(Voyant.panel.Panel)');
    	if (parentPanel != null) {
	    	parentPanel.on("loadedCorpus", function(src, corpus) {
	    		me.doSetCorpus(corpus);
	    	}, me);
	    	me.hasCorpusLoadedListener = true;
    	}
    	
    	me.on("afterrender", function(c) {
    		if (me.hasCorpusLoadedListener === false) {
	    		parentPanel = me.up('panel:mixin(Voyant.panel.Panel)');
	    		var corpus = parentPanel.getApplication().getCorpus();
				if (corpus !== undefined) {
					me.doSetCorpus(corpus);
				} else {
					parentPanel.on("loadedCorpus", function(src, corpus) {
						me.doSetCorpus(corpus);
			    	}, me);
					me.hasCorpusLoadedListener = true;
				}
    		}
			
    		if (me.triggers && me.triggers.help) {
    			Ext.tip.QuickTipManager.register({
    				target: me.triggers.help.getEl(),
    				text: me.getIsDocsMode() ? me.localize('querySearchDocsModeTip') : me.localize('querySearchTip')
				});
			}
    		if (me.triggers && me.triggers.count) {
    			Ext.tip.QuickTipManager.register({
    				target: me.triggers.count.getEl(),
    				text: me.localize('aggregateInDocumentsCount')
				});
			}
    	});
    	
    	me.on("beforedestroy", function(c) {
    		if (me.triggers && me.triggers.help) {
    			Ext.tip.QuickTipManager.unregister(me.triggers.help.getEl());
    		}
    		if (me.triggers && me.triggers.count) {
    			Ext.tip.QuickTipManager.unregister(me.triggers.count.getEl());
    		}
    	});
    	
    	me.callParent(arguments);
    },
    
    doSetCorpus: function(corpus) {
    	if (corpus != null) {
	    	this.setCorpus(corpus);
			var stopList = this.getStopList();
			if (stopList==undefined) {
	    		if (this.getApiParam) {this.setStopList(this.getApiParam("stopList"))}
	    		else {
	    			var parent = this.up("panel");
	    			if (parent && parent.getApiParam) {
	    				this.setStopList(parent.getApiParam("stopList"))
	    			}
	    		}
			}
	
			this.setStore(corpus.getCorpusTerms({
				corpus: corpus,
				proxy: {
					extraParams: {
		    			limit: 10,
		    			tokenType: this.tokenType,
		    			stopList: this.getStopList(),
		    			inDocumentsCountOnly: this.getInDocumentsCountOnly()
					}
				}
			}));
    	}
    }
    
});

// query components by mixin class name
Ext.ComponentQuery.pseudos.mixin = function(components, selector) {
	var i = 0, l = components.length, c, result = [];
	for (; i < l; i++) {
        c = components[i];
        if (c.mixins) {
        	for (var className in c.mixins) {
        		if (className == selector) {
        			result.push(c);
        			break;
        		}
        	}
        }
	}
	return result;
};
