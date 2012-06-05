/**
 * Ext.ux.OfflineSyncStore
 *
 * This class allows you to create a store with two Proxies that will allow offline storage much simpler and easier to handle.
 *
 * The store is configured with a Local Proxy and a Server Proxy which means that a local copy of the data is always persisted with the changes that haven't been
 * synced with the server also retained. This means that you can easily sync all outstanding changes to the server (using the Server Proxy) when you want.
 *
 * This enables offline/online management of data to be far easier as a single copy of the data is always maintained in local storage and a Server syncronisation
 * can be done at any time, either when the app comes back online, in a batch after a certain amount of time or, if the app is online, then straight away.
 */
Ext.define('Ext.ux.OfflineSyncStore', {

	extend: 'Ext.data.Store',

	config: {

		/**
		 * @cfg {Boolean} trackLocalSync Determines whether the store will track the records being synced to the local storage location. If true any records being saved locally will be cached
		 * so the server proxy will pick them up and save them to the server when told. If false records are simply saved locally and no record is kept for the server.
		 * @accessor
		 */
		trackLocalSync: true,

		/**
		 * @cfg {Boolean/Function} autoServerSync Set to true to have the store automatically attempt to sync any changes to the server after a local save is made. You can also
		 * set this as a function that will return a Boolean value indicating whether a server sync will be attempted immediately after a local save. This could be used to check
		 * for an internet connection to decide whether a sync should be made straight away or not.
		 * @accessor
		 */
		autoServerSync: true,

		/**
		 * @cfg {Object} localProxy A Proxy instance that will be used when storing the store's contents locally. Generally a LocalStorage proxy.
		 * @accessor
		 */
		localProxy: null,

		/**
		 * @cfg {Object} serverProxy A Proxy instance that will be used when syncing the store's contents to the server. Generally a Ajax proxy.
		 * @accessor
		 */
		serverProxy: null

	},

	statics: {
		CREATED: 'created',
		UPDATED: 'updated',
		REMOVED: 'removed'
	},

	constructor: function(config){
		config = config || {};

		this.callParent([config]);
	},

	/**
	 * Loads the store using the LocalProxy and populates itself with records stored in the local storage location.
	 * @method
	 * @public
	 * @param options
	 * @param scope
	 * @return {void}
	 */
	loadLocal: function(options, scope){
		this._proxy = this.getLocalProxy();

		this.load(options, scope, true);
	},

	/**
	 * Uses the defined ServerProxy to load the store's data.
	 * @method
	 * @public
	 * @param options
	 * @param scope
	 * @return {void}
	 */
	loadServer: function(options, scope){
		this._proxy = this.getServerProxy();

		this.on({
			load: {
				fn: this.onServerLoad,
				single: true,
				scope: this
			}
		});

		this.load(options, scope, true);
	},

	/**
	 * Syncs all the outstanding changes in the store using the Local Proxy.
	 * It will then take each set of synced records (created, updated, deleted) and cache the data in a separate local storage
	 * area so they can be picked up again by the Server Proxy and saved to the server.
	 * @method
	 * @public
	 * @returns {Object}
	 */
	sync: function(){
		this._proxy = this.getLocalProxy();

		var syncRecords = this.callParent(arguments);

		var createdRecords = syncRecords.added,
			updatedRecords = syncRecords.updated,
			removedRecords = syncRecords.removed;

		if(this.getTrackLocalSync()){
			if(createdRecords.length > 0){
				this.storeCreated(createdRecords);
			}
			if(updatedRecords.length > 0){
				this.storeUpdated(updatedRecords);
			}
			if(removedRecords.length > 0){
				this.storeRemoved(removedRecords);
			}

			if(this.doAutoServerSync()){
				this.syncServer();
			}
		}

		return syncRecords;
	},

	/**
	 * Sync any outstanding changes with the server using the Server Proxy.
	 * This is an copy of the Ext.data.Store's original sync method but changes where the created, updated and removed records are sourced from.
	 * This instead pulls them from the cache that we have been keeping after every local sync.
	 * @method
	 * @public
	 * @return {Object} An object containing 3 properties containing the modified records - added, updated, removed.
	 */
	syncServer: function(){

		this._proxy = this.getServerProxy();

		var me = this,
			operations = {},
			toCreate = me.getModifiedRecordsCollection(Ext.ux.OfflineSyncStore.CREATED),
			toUpdate = me.getModifiedRecordsCollection(Ext.ux.OfflineSyncStore.UPDATED),
			toDestroy = me.getRemovedRecordsCollection(Ext.ux.OfflineSyncStore.REMOVED),
			needsSync = false;

		if (toCreate.length > 0) {

			// assign the record's internal ID property to the Model's ID Property so the server can regen it and return it back.
			// This is required so the store can map up the returned records to the ones in the store to update IDs etc.
			// When we do a local save a new ID gets generated for the record which we don't want to send to the server.
			for(var i = 0; i < toCreate.length; i++){
				toCreate[i].data[this.getModel().getIdProperty()] = toCreate[i].id;
			}

			operations.create = toCreate;
			needsSync = true;
		}

		if (toUpdate.length > 0) {
			operations.update = toUpdate;
			needsSync = true;
		}

		if (toDestroy.length > 0) {
			operations.destroy = toDestroy;
			needsSync = true;
		}

		if (needsSync && me.fireEvent('beforesync', this, operations) !== false) {
			me.getProxy().batch({
				operations: operations,
				listeners: me.getBatchListeners()
			});
		}

		return {
			added: toCreate,
			updated: toUpdate,
			removed: toDestroy
		};
	},


	/**
	 * In this method we update our '-created' collection in localStorage with the newly added records.
	 * No complicated merging needs to take place here as the created records are at the top of the tree.
	 * @method
	 * @private
	 * @param {Ext.data.Model[]} created An array of model instances that have just been added to the store
	 * @returns {void}
	 */
	storeCreated: function(created){
		this.storeChanged(created, Ext.ux.OfflineSyncStore.CREATED, false);
	},


	/**
	 * In this method we want to update our '-created' and '-updated' collections in localStorage.
	 * There is some extra processing needing to be done as conflicts could appear between the updated and created collections.
	 * - If an updated record is already in the '-created' collection then the data inside that entry must be replace with the newly updated data and the record NOT added to the '-updated' collection. This is because
	 *   the record is still 'phantom' and so must first be created properly.
	 * - If an updated record isn't in the '-created' collection then it must be a normal, committed record and so it is added to the updated array and saved to localStorage
	 * @method
	 * @private
	 * @param {Ext.data.Model[]} updated
	 * @returns {void}
	 */
	storeUpdated: function(updated){

		var createdCollection = this.getModifiedCollection(Ext.ux.OfflineSyncStore.CREATED),
			createdMergeCollection = [], // stores any data objects that exist in the 'created' collection and so must be merged in and then saved
			updatedSaveCollection = [], // stores any data objects that DON'T exist in the 'created' collection and so must be saved in the 'updated' collection as normal
			matched = false,
			modelIDField = this.getModel().getIdProperty();

		// find any records in the updated array that already exist in the 'created' collection and store them so they can be merged
		for(var i = 0; i < updated.length; i++){
			var updatedItem = updated[i];

			for(var j = 0; j < createdCollection.length; j++){
				if(updatedItem.data[modelIDField] === createdCollection[j][modelIDField]){
					matched = true;
					break;
				}
			}

			if(matched){
				createdMergeCollection.push(updatedItem.data);
			} else {
				updatedSaveCollection.push(updatedItem);
			}
		}

		this.storeChanged(this.mergeOrReplaceArrays(createdCollection, createdMergeCollection), Ext.ux.OfflineSyncStore.CREATED, true);

		this.storeChanged(updatedSaveCollection, Ext.ux.OfflineSyncStore.UPDATED, false);
	},

	/**
	 * In this method we want to update our '-created', '-updated' and '-removed' collections in localStorage that form the basis of our server syncs.
	 * When removing records there is added complexity which has to be considered.
	 * - If a removed record is already in the '-created' collection then it must be removed from here and NOT added to the removed array. This is because it isn't yet a committed record and so doesn't need proper removal.
	 * - If a removed record is already in the '-updated' collection then it must be removed from here and then added to the removed array. As we are removing it the updates can be thrown away.
	 * - If a removed record is in neither of these collections then it is added to the removed array and saved to the local storage
	 * @method
	 * @private
	 * @param {Ext.data.Model[]} removed A collection of Model instances that have been removed from the Store
	 * @returns {void}
	 */
	storeRemoved: function(removed){

		var createdCollection = this.getModifiedCollection(Ext.ux.OfflineSyncStore.CREATED),
			updatedCollection = this.getModifiedCollection(Ext.ux.OfflineSyncStore.UPDATED),
			removedSaveCollection = [], // stores any data objects that DON'T exist in the 'created' collection and so must be saved in the 'updated' collection as normal
			createdMatched = false,
			modelIDField = this.getModel().getIdProperty();

		// find any records in the updated array that already exist in the 'created' and 'updated' collections and remove them
		for(var i = 0; i < removed.length; i++){
			var removedItem = removed[i];

			// loop through 'created' collection and check if there is a match for the current removedItem. If there is remove it from the array
			for(var j = 0; j < createdCollection.length; j++){
				if(removedItem.data[modelIDField] === createdCollection[j][modelIDField]){
					createdMatched = true;
					createdCollection.splice(j, 1);
					break;
				}
			}

			// loop through 'updated' collection and check if there is a match for the current removedItem. If there is remove it from the array
			for(var k = 0; k < updatedCollection.length; k++){
				if(removedItem.data[modelIDField] === updatedCollection[k][modelIDField]){
					updatedCollection.splice(k, 1);
					break;
				}
			}

			// if the removedItem was not in the created collection then it is a proper removal so we add to the removedSaveCollection
			if(!createdMatched){
				removedSaveCollection.push(removedItem);
			}
		}

		this.storeChanged(createdCollection, Ext.ux.OfflineSyncStore.CREATED, true);

		this.storeChanged(updatedCollection, Ext.ux.OfflineSyncStore.UPDATED, true);

		this.storeChanged(removedSaveCollection, Ext.ux.OfflineSyncStore.REMOVED, false);
	},

	/**
	 * Stores the specified items array in localStorage with the specified key suffix. The final parameter determines if the objects in the array are
	 * in fact Model instances or not. If they are then the data is extracted from their 'data' property, otherwise the item is used as is.
	 * @method
	 * @private
	 * @param {Object[]/Ext.data.Model[]} modifiedItems An array of Model instances or simple objects
	 * @param {String} key The key suffix to store the data under. E.g. 'created' will store data in '<proxy id>-created'
	 * @param {Boolean} replace Determines if the modifiedItems array should replace the array that exists or if it should be merged.
	 * @return {void}
	 */
	storeChanged: function(modifiedItems, key, replace){
		var storageKey = this.getLocalProxy().getId() + '-' + key,
			toSaveDataArray = [];

		for(var i = 0; i < modifiedItems.length; i++){
			var itemData = modifiedItems[i].isModel ? modifiedItems[i].data : modifiedItems[i];

			toSaveDataArray.push(itemData);
		}

		var currentDataSetRaw = localStorage.getItem(storageKey),
			currentDataSet = !Ext.isEmpty(currentDataSetRaw) ? Ext.decode(currentDataSetRaw) : [];

		if(!replace){
			toSaveDataArray = this.mergeOrReplaceArrays(currentDataSet, toSaveDataArray);
		}

		localStorage.removeItem(storageKey);
		localStorage.setItem(storageKey, Ext.encode(toSaveDataArray));
	},

	/**
	 * Callback method that is executed when the ServerProxy completes a create action.
	 * @method
	 * @private
	 * @param records
	 * @param operation
	 * @param success
	 */
	onCreateRecords: function(records, operation, success) {
		this.callParent(arguments);

		if(success && !this.isLocalMode()){
			this.clearModifiedCollection(Ext.ux.OfflineSyncStore.CREATED);
		}
	},

	/**
	 * Callback method that is executed when the ServerProxy completes an updated action.
	 * @method
	 * @private
	 * @param records
	 * @param operation
	 * @param success
	 */
	onUpdateRecords: function(records, operation, success) {
		this.callParent(arguments);

		if(success && !this.isLocalMode()){
			this.clearModifiedCollection(Ext.ux.OfflineSyncStore.UPDATED);
		}
	},

	/**
	 * Callback method that is executed when the ServerProxy completes a destroy action.
	 * @method
	 * @private
	 * @param records
	 * @param operation
	 * @param success
	 */
	onDestroyRecords: function(records, operation, success) {
		this.callParent(arguments);

		if(success && !this.isLocalMode()){
			this.clearModifiedCollection(Ext.ux.OfflineSyncStore.REMOVED);
		}
	},

	/**
	 * Clears the specified key's localStorage entry.
	 * This is used when a server sync has completed and so the cached collection must be removed.
	 * @method
	 * @private
	 * @param {String} key The localStorage key to delete. It is combined with the LocalProxy's ID
	 * @return {void}
	 */
	clearModifiedCollection: function(key){
		localStorage.removeItem(this.getLocalProxy().getId() + '-' + key);
	},

	/**
	 * Returns an array of data items retrieved from the localStorage based on the specified key and the Local Proxy's
	 * ID property.
	 * An empty array is returned if no value is found.
	 * @method
	 * @private
	 * @param {String} key
	 * @return {Object[]}
	 */
	getModifiedCollection: function(key){

		var currentDataSetRaw = localStorage.getItem(this.getLocalProxy().getId() + '-' + key),
			currentDataSet = !Ext.isEmpty(currentDataSetRaw) ? Ext.decode(currentDataSetRaw) : [];

		return currentDataSet;
	},

	/**
	 * Returns an array of the actual records that are stored in the specified holding area.
	 * @method
	 * @private
	 * @param {String} key The key for the localStorage area storing the cached changed records. Possible values are 'created', 'updated', 'removed'
	 * @return {Ext.data.Model[]} An array of model instances from the store itself that are being cached in the modified collections
	 */
	getModifiedRecordsCollection: function(key){
		var modifiedCollection = this.getModifiedCollection(key),
			modifiedRecordsCollection = [];

		for(var i = 0; i < modifiedCollection.length; i++){
			var record = this.getById(modifiedCollection[i][this.getModel().getIdProperty()]);

			if(record){
				modifiedRecordsCollection.push(record);
			}
		}

		return modifiedRecordsCollection;
	},

	/**
	 * Returns an array of the record instances created from the data of the removed records stored in the holding area.
	 * @method
	 * @private
	 * @param {String} key The key for the localStorage area storing the cached changed records. Possible values are 'created', 'updated', 'removed'
	 * @return {Ext.data.Model[]} An array of model instances created specially from the data that is being cached in the modified collections
	 */
	getRemovedRecordsCollection: function(key){
		var modifiedCollection = this.getModifiedCollection(key),
			modifiedRecordsCollection = [];

		for(var i = 0; i < modifiedCollection.length; i++){
			var record = this.getModel().create(modifiedCollection[i]);

			if(record){
				modifiedRecordsCollection.push(record);
			}
		}

		return modifiedRecordsCollection;
	},


	/**
	 * Event handler that is fired when the store fires it's 'load' event while performing a load with the Server Proxy.
	 * This will save all the data loaded from the Server into the Local storage device so it can be retained.
	 * If the load was unsuccessful we revert it back to the Local Proxy's data.
	 * @method
	 * @private
	 * @param store
	 * @param records
	 * @param successful
	 * @return {void}
	 */
	onServerLoad: function(store, records, successful) {
		if (successful) {
			// If load was a success we must populate the Local Proxy with the new data
			this._proxy = this.getLocalProxy();

			// clear the existing data first
			this._proxy.clear();

			// To ensure the Local Proxy identifies all the records as dirty (i.e. requiring to be saved) we mark them all as dirty
			store.each(function(record) {
				record.setDirty(true);
			});

			// disable tracking so the server won't try and resave the data being synced
			this.disableTrackLocalSync();

			// Save the changes with the Local Proxy
			this.sync();

			// Commit each record so we don't resave it again
			store.each(function(record) {
				record.commit();
			});

			// enable the tracking so any subsequent syncs are tracked
			this.enableTrackLocalSync();
		}
		else {
			// Go back to the Local Proxy if our load fails
			this.loadLocal();
		}
	},

	/**
	 * Returns true if the store is currently in 'Local Mode', i.e. the current proxy is the LocalProxy.
	 * @method
	 * @public
	 * @return {Boolean}
	 */
	isLocalMode: function(){
		return this.getProxy() === this.getLocalProxy();
	},

	/**
	 * Disables the tracking of local syncs which means any data saved using the Local Proxy won't be tracked
	 * so it can be mirrored with the Server Proxy.
	 * @method
	 * @public
	 * @returns {void}
	 */
	disableTrackLocalSync: function(){
		this.setTrackLocalSync(false);
	},

	/**
	 * Enables the tracking of local syncs which means any data saved using the Local Proxy will be tracked
	 * so it can be mirrored with the Server Proxy.
	 * @method
	 * @public
	 * @returns {void}
	 */
	enableTrackLocalSync: function(){
		this.setTrackLocalSync(true);
	},

	/**
	 * Returns a boolean value indicating whether the store has some changes awaiting a sync with the server.
	 * This includes created, updated and removed records.
	 * @method
	 * @public
	 * @return {Boolean}
	 */
	hasPendingServerSync: function(){
		return this.hasPendingCreated() || this.hasPendingUpdated() || this.hasPendingRemoved();
	},

	/**
	 * Returns a boolean value indicating whether the store has any CREATED records awaiting server sync.
	 * @method
	 * @public
	 * @return {Boolean}
	 */
	hasPendingCreated: function(){
		return this.getModifiedCollection(Ext.ux.OfflineSyncStore.CREATED).length > 0;
	},

	/**
	 * Returns a boolean value indicating whether the store has any UPDATED records awaiting server sync.
	 * @method
	 * @public
	 * @return {Boolean}
	 */
	hasPendingUpdated: function(){
		return this.getModifiedCollection(Ext.ux.OfflineSyncStore.UPDATED).length > 0;
	},

	/**
	 * Returns a boolean value indicating whether the store has any REMOVED records awaiting server sync.
	 * @method
	 * @public
	 * @return {Boolean}
	 */
	hasPendingRemoved: function(){
		return this.getModifiedCollection(Ext.ux.OfflineSyncStore.REMOVED).length > 0;
	},

	/**
	 * Processes the possible values for the autoServerSync config (can be either a Boolean or a Function) and
	 * returns the current value. Either the Boolean value that the autoServerSync config has or the result of the
	 * Function stored in the config.
	 * @method
	 * @private
	 * @return {Boolean}
	 */
	doAutoServerSync: function(){
		var doSync = this.getAutoServerSync();

		if(Ext.isFunction(doSync)){
			doSync = doSync.call(this);
		}

		return doSync;
	},

	applyServerProxy: function(proxy, currentProxy) {
		return this.applyProxy(proxy, currentProxy);
	},

	updateServerProxy: function(proxy) {
		this.updateProxy(proxy);
	},

	applyLocalProxy: function(proxy, currentProxy) {
		return this.applyProxy(proxy, currentProxy);
	},

	updateLocalProxy: function(proxy) {
		this.updateProxy(proxy);
	},

	/**
	 * Merges 'array1' into 'array2' with any duplicates based on the specified 'idKey' being ignored with 'array2's' value being included.
	 * @method
	 * @private
	 * @param {Object[]} array1
	 * @param {Object[]} array2
	 * @param {String} idKey The property to use to find matching items
	 * @return {Object[]}
	 */
	mergeOrReplaceArrays: function(array1, array2, idKey){
		var i = 0,
			l = array1.length,
			l2 = array2.length,
			present = false;

		idKey = idKey || this.getModel().getIdProperty();

		for(; i < l; i++){

			for(var j = 0; j < l2; j++){

				if(array1[i][idKey] === array2[j][idKey]){
					present = true;
					break;
				}
			}

			if(!present){
				array2.push(array1[i]);
			}

			present = false;
		}

		return array2;
	}
});