(function() {

    return {

        events: require('events'),

        requests: {},

        options:  {
            requirementsCreated: false,
            installationID: undefined,
            createTrigger: true,
            triggerTitle: 'out-of-office app unassign trigger [System Trigger]',
            userFieldDescription: "This field was created by the out-of-office app. Don't delete it, unless you want everything to break",
            userFieldName: 'Agent Out?',
            userFieldKey: 'agent_ooo',
            confirmChange: true,
            unassignTickets: false,
            preventAssignOOO: true,

            // The following is not used in the OOO app due to other apps modal collision issues and will be saved for use in a future release
            // saveWarningButton: warning = '<p style="margin-top: 16px; margin-bottom: 10px; margin-left: 60px; font-weight: bold; font-size: 14px;">AGENT UNAVAILABLE</p><p class="btn" style="width: 250px; font-weight: bold; font-size: 14px; margin-bottom: 16px; padding-top: 10px; padding-bottom: 10px;" onclick="$(\'button.status-toggle\').trigger(\'click\');">Update ' + agent.name + '\'s status</p>';
            
            saveFailMessage: '<p style="margin-top: 16px; margin-bottom: 10px; text-align: center; font-weight: bold; font-size: 20px;">TICKET NOT SAVED</p>',
            saveWarning: function(name) { 
                return '<p style="margin-top: 16px; margin-bottom: 10px; text-align: center; font-size: 14px;"><strong>' + name + '</strong> is <strong>UNAVAILABLE</strong><br/></p><p style="margin-top: 12px; margin-bottom: 6px; text-align: center; font-size: 14px;">If this request requires immediate attention please re-assign to a different agent</p>';
            },

            changeStatusMessage: function(name, unassignTickets, availableHeader, availableContentFirst, availableContentSecond, availableConfirm, availableCancel, unavailableHeader, unavailableContentFirst, unavailableContentSecond, unavailableConfirm, unavailableCancel, checkboxText) { // right before 127 in ui.js it passes in the agent name and gets an object that contains the available / unavailable html defninitation to create the modal - need to change this function needs another parameter to see maybe where there's availabe & an object - unavailbale & an object is a checkbox in the option section - clear it out to be blank it will no longer send hte checkbox through

                var checkbox = '<p style="font-family: proxima-nova, sans-serif;"><label><input type="checkbox" name="reassign_current" /><span id="foo">' + checkboxText + '</span></label></p>';
                if (unassignTickets === true) {  // **NOTE** checkbox CHECKED = checkbox HIDDEN ; unassignTickets option TRUE = checkbox HIDDEN
                    checkbox = undefined;
                }
                return {

                    available: {
                        header:  availableHeader,
                        content: '<p>' + availableContentFirst + '<strong>' + name + '</strong>' + availableContentSecond + '</p>',
                        confirm: '<p style="color: white; font-family: proxima-nova, sans-serif; background-color: #79a21d; border-color: #79a21d; font-size: 100%; height: 100%; line-height: 200%; border-radius: 3px; padding-top: 8px; padding-bottom: 8px">' + availableConfirm + '</p>',        
                        cancel:  availableCancel
                    },
                    unavailable: {
                        header:  unavailableHeader,
                        content: '<p>' + unavailableContentFirst + '<strong>' + name + '</strong>' + unavailableContentSecond + '</p>',
                        confirm: '<p style="color: white; font-family: proxima-nova, sans-serif; font-size: 100%; height: 100%; line-height: 200%; border-radius: 3px; padding-top: 8px; padding-bottom:8px">' + unavailableConfirm + '</p>',
                        cancel:  unavailableCancel,
                        options: checkbox
                    }
                };
            },
        },

        lockRender: false,
        renderRetries: 0,        

        //app.created
        init: function(app) {
        //    console.log(this.I18n.t('trigger.title'));
            this.switchTo('loading');
            this.require = require('context_loader')(this);            
            this.require('install_app', this.options).loadSettings();
        },

        //loaded_settings
        createSettings: function(evt) {
            this.options = evt.settings;
            this.trigger("render_app");
        },

        //app.activated
        //pane.activated
        //render_app
        //ticket.assignee.user.id.changed
        //ticket.assignee.group.id.changed
        render: function(evt) {
            var ui = this.require('ui', this.options);
            if(!this.lockRender) {
                if (this.currentLocation() == 'nav_bar') {
                    var filter = this.$('#filter_search').val();
                    ui.renderNavBar(filter); 
                } else if (this.currentLocation() == 'user_sidebar') {
                    ui.renderUser(); 
                } else if (this.currentLocation() == 'ticket_sidebar' || this.currentLocation() == 'new_ticket_sidebar') {
                    ui.renderTicket();
                } 
            } 
        },

        //click .set-status
        verifyChange: function(evt) {
            var agentID = evt.currentTarget.value;
            var ui = this.require('ui', this.options);
            var that = this;
            if(this.options.confirmChange) {
                ui.renderStatusModal(agentID);
            } else {
                this.trigger("toggle_status", {agentID: agentID, unassignTickets: that.options.unassignTickets});
            }
        },

        //toggle_status
        updateStatus: function(evt) {
            var agentID = evt.agentID;
            var unassignTickets = evt.unassignTickets;
            var that = this;
            this.require('update_status', this.options).toggleStatus(agentID, unassignTickets);
        },

        //status_changed
        notifyStatus: function(evt) {
            var status = this.I18n.t('notify.status.available');
            var tags = this.I18n.t('notify.status.tags.removed');
            if(evt.agent.user_fields[this.options.userFieldKey]) {
                status = this.I18n.t('notify.status.unavailable');
                tags = this.I18n.t('notify.status.tags.added');
            } 
            var statusMessage = '<p>' + evt.agent.name + ' is now <strong>' + status + '.</strong> </p>';
            var tagsMessage = '<p>Tickets assigned to <strong>' + evt.agent.name + '</strong> with the status <strong>Pending/On-Hold</strong> will have the <strong>\"agent_ooo\"</strong> tag <strong>' + tags + '</strong>.</p>';
            services.notify(statusMessage + tagsMessage, 5000);
            this.trigger("render_app");
        },

        warnStatus: function(evt) {
            if(evt.agent.user_fields[this.options.userFieldKey]) {
                services.notify(this.options.saveWarning(evt.agent.name), 'warning', 5000);
            }
        },

        //status_error
        notifyFail: function(evt) {
            services.notify("Unable to update status for " + evt.agent.name, 'alert');
        },

        //createTrigger.done
        //createUserField.done
        notifyInstalled: function(item) {
            switch(item) {
                case 'trigger': services.notify(this.I18n.t('notify.installed.trigger'), 'alert');
                    break;
                case 'user_field': services.notify(this.I18n.t('notify.installed.user_field'), 'alert');
                    break;
            }
        },

        //tickets_tagged
        notifyUnAssign: function(evt) {
            var action = this.I18n.t('notify.unassign.default.action');
            var status = this.I18n.t('notify.unassign.default.status');
            if(evt.ticketView == 'pendingTickets') {
                status = this.I18n.t('notify.unassign.pendingTickets.status');
            } else if(evt.ticketView == 'ticketPreview') {
                action = this.I18n.t('notify.unassign.ticketPreview.action');
                status = this.I18n.t('notify.unassign.ticketPreview.status');
            }
            services.notify(action + evt.count + status + evt.name + ".");
        },

        //assigned_ooo
        notifyAssign: function(name) {
            services.notify("Ticket assigned to " + name + " who is unavailable", 'alert');
        },

        renderSave: function() {
            var ui = this.require('ui', this.options);
            return ui.renderSave();        
        },

        //functional_error
        functionalError: function(evt) {
            console.log(evt);
            switch(evt.location) {
                case 'setStatusPending': services.notify('Unable to look up pending tickets for ' + evt.agent.name + '. This agent may not be an assignable agent.', 'error', 5000);
                    break;
                case 'setStatus': if(evt.errorCode == 403) {
                    services.notify('Permissions error while updating status for ' + evt.agent.name + '. Please make sure you are allowed to update their user profile.', 'error', 5000);
                }
            }
        },

        //network_error
        networkError: function(evt) {
            console.log(evt);
        },
        
        //getAllAgents.fail
        //getSingleAgent.fail
        renderRetry: function() {
            if(this.renderRetries < 0){
                this.trigger("render_app");
            }
            this.renderRetries++;
        }
    };
}());
