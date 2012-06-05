describe("Ext.ux.OfflineSyncStore", function(){
	var me = this;

	/**
	 * Creates and returns a new OfflineSyncStore instance
	 * @method
	 * @return {Ext.ux.OfflineSyncStore} The newly created store
	 */
	me.getOfflineSyncStore = function(){
		var config = {
			model: 'Person',

			localProxy: {
				type: 'localstorage',
				id: 'offline-sync-store'
			},

			serverProxy: {
				type: 'ajax',
				api: {
					read: '../server/select.php',
					create: '../server/save.php',
					update: '../server/save.php',
					destroy: '../server/delete.php'
				},
				reader: {
					type: 'json',
					rootProperty: 'rows'
				},
				writer: {
					allowSingle: false
				}
			},
			autoServerSync: false
		};

		return Ext.create('Ext.ux.OfflineSyncStore', config);
	};

	/**
	* Creates and Loads an OfflineSyncStore instance from a static JSON file.
		*/
	me.createAndLoadPersonStore = function(){

		localStorage.clear();

		var offlineSyncStore = me.getOfflineSyncStore();

		offlineSyncStore.loadServer();

		waitsFor(function(){
			return !offlineSyncStore.isLoading();
		}, 'Person ServerLoad didn\'t complete.', 250);

		return offlineSyncStore;
	};

	/**
	* Returns a new, valid Person record
	* @method
	* @private
	* @return {TG.model.Person}
	*/
	me.getNewPersonRecord = function(){
		return Ext.create('Person', me.getNewPersonData());
	};

	/**
	* Returns a data object that can be used to create a new Person record
	* @method
	* @private
	* @return {Object}
	*/
	me.getNewPersonData = function(){
		return {
			FirstName: 'Joe',
			LastName: 'Bloggs',
			Email: 'joe@swarmonline.com'
		};
	};

	afterEach(function () {

		//  destroy any stores that are hanging about so our memory usage doesn't rocket...
		Ext.Array.each(Ext.StoreManager.items, function(store){
			store.destroy();
		});
	});

	describe("Person Load Tests", function(){

		it("Store loads correct number of records from JSON file", function(){

			var expectedRecordCount = 2,
				offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){
				expect(offlineSyncStore.getCount()).toEqual(expectedRecordCount);
			});
		});

		it("Model mappings are correct and have correct values", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){
				var person = offlineSyncStore.getAt(offlineSyncStore.find('PersonID', 1));

				expect(person.get('FirstName')).toEqual('Stuart');
				expect(person.get('LastName')).toEqual('Ashworth');
				expect(person.get('Email')).toEqual('stuart@swarmonline.com');
			});
		});


	});


	describe("MergeOrReplaceArray method tests", function(){

		it("Single Item & Empty Array merge into an array with 1 item", function(){

			var store = Ext.create('Ext.ux.OfflineSyncStore', {});

			var array1 = [{id: 1, val: 'row1'}],
				array2 = [];

			var mergedArray = store.mergeOrReplaceArrays(array1, array2, 'id');

			expect(Ext.encode(mergedArray)).toEqual(Ext.encode([{id: 1, val: 'row1'}]));
		});

		it("Single Item & Empty Array merge into an array with 1 item", function(){

			var store = Ext.create('Ext.ux.OfflineSyncStore', {});

			var array1 = [],
				array2 = [{id: 1, val: 'row1'}];

			var mergedArray = store.mergeOrReplaceArrays(array1, array2, 'id');

			expect(Ext.encode(mergedArray)).toEqual(Ext.encode([{id: 1, val: 'row1'}]));
		});

		it("2 (non-conflicting) Single Item Arrays merge into an array with 2 item", function(){

			var store = Ext.create('Ext.ux.OfflineSyncStore', {});

			var array1 = [{id: 1, val: 'row1'}],
				array2 = [{id: 2, val: 'row2'}];

			var mergedArray = store.mergeOrReplaceArrays(array1, array2, 'id');

			expect(Ext.encode(mergedArray)).toEqual(Ext.encode([{id: 2, val: 'row2'}, {id: 1, val: 'row1'}]));
		});

		it("2 (conflicting) Single Item Arrays merge into an array with 1 item containing array2's contents", function(){

			var store = Ext.create('Ext.ux.OfflineSyncStore', {});

			var array1 = [{id: 1, val: 'row1'}],
				array2 = [{id: 1, val: 'row2'}];

			var mergedArray = store.mergeOrReplaceArrays(array1, array2, 'id');

			expect(Ext.encode(mergedArray)).toEqual(Ext.encode([{id: 1, val: 'row2'}]));
		});

		it("2 (conflicting) Multiple Item Arrays merge into an array with 4 items containing array2's contents", function(){

			var store = Ext.create('Ext.ux.OfflineSyncStore', {});

			var array1 = [{id: 1, val: 'row1'}, {id: 2, val: 'row2'}, {id: 3, val: 'row3'}],
				array2 = [{id: 4, val: 'row4'}, {id: 2, val: 'NEW ROW 2'}];

			var mergedArray = store.mergeOrReplaceArrays(array1, array2, 'id');

			var expectedArray = [{id: 4, val: 'row4'}, {id: 2, val: 'NEW ROW 2'}, {id: 1, val: 'row1'}, {id: 3, val: 'row3'}];

			expect(Ext.encode(mergedArray)).toEqual(Ext.encode(expectedArray));
		});

	});

	describe("Person local save tests", function(){

		it("(1) Removed record is added to '-removed' collection in localStorage and removed from store", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				expect(offlineSyncStore.getCount()).toEqual(2);

				var personData = offlineSyncStore.getAt(0).data;

				offlineSyncStore.removeAt(0);

				offlineSyncStore.sync();

				expect(offlineSyncStore.getCount()).toEqual(1);

				var removedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-removed');

				expect(removedCollection).toEqual(Ext.encode([personData]));

			});

		});

		it("(2) Added record is added to '-created' collection in localStorage and added to the store [SINGLE]", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){
				expect(offlineSyncStore.getCount()).toEqual(2);

				var personRecord = me.getNewPersonRecord();

				offlineSyncStore.add(personRecord);

				offlineSyncStore.sync();

				expect(offlineSyncStore.getCount()).toEqual(3);

				var createdCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-created');

				expect(createdCollection).toEqual(Ext.encode([personRecord.data]));

			});

		});

		it("(3) Updated record is added to '-updated' collection in localStorage and updated in the store [SINGLE]", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				expect(offlineSyncStore.getCount()).toEqual(2);

				var personRecord = offlineSyncStore.getAt(0);

				personRecord.set('FirstName', 'UPDATED FIRSTNAME FIELD');

				offlineSyncStore.sync();

				expect(offlineSyncStore.getCount()).toEqual(2);

				var updatedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-updated');

				expect(updatedCollection).toEqual(Ext.encode([personRecord.data]));

			});

		});

		it("(3.1) Multiple updated record is added to '-updated' collection in localStorage ONLY ONCE and updated in the store [SINGLE]", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				expect(offlineSyncStore.getCount()).toEqual(2);

				var personRecord = offlineSyncStore.getAt(0);

				// update & sync record for 1st time
				personRecord.set('FirstName', 'UPDATED FIRSTNAME FIELD');
				offlineSyncStore.sync();

				// check it's still in store
				expect(offlineSyncStore.getCount()).toEqual(2);

				// check '-updated' collection contains record's data
				var updatedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-updated');
				expect(updatedCollection).toEqual(Ext.encode([personRecord.data]));

				// update & sync record for 2nd time
				personRecord.set('FirstName', 'UPDATED FIRSTNAME FIELD SECOND');
				offlineSyncStore.sync();

				// check it's still in store
				expect(offlineSyncStore.getCount()).toEqual(2);

				// check '-updated' collection contains record's data
				var updatedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-updated');
				expect(updatedCollection).toEqual(Ext.encode([personRecord.data]));

			});

		});

		it("(4) Added record is added to '-created' collection and after being updated remains in the '-created' collection and is not added to the '-updated' collection [SINGLE]", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				expect(offlineSyncStore.getCount()).toEqual(2);

				var personRecord = me.getNewPersonRecord();

				// add and sync new record
				offlineSyncStore.add(personRecord);
				offlineSyncStore.sync();

				// new record is in store
				expect(offlineSyncStore.getCount()).toEqual(3);

				// check new record is in '-created' collection
				var createdCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-created');
				expect(createdCollection).toEqual(Ext.encode([personRecord.data]));


				// update and sync new record
				personRecord.set('FirstName', 'UPDATED FIRSTNAME FIELD');
				offlineSyncStore.sync();

				// new record is still in store
				expect(offlineSyncStore.getCount()).toEqual(3);

				// check new record is in '-created' collection
				var createdCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-created');
				expect(createdCollection).toEqual(Ext.encode([personRecord.data]));

				// check new record is NOT in '-updated' collection
				var updatedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-updated');
				expect(updatedCollection).toEqual(Ext.encode([]));

			});

		});

		it("(5) Added record is added to '-created' collection. When deleted it is removed from the '-created' collection and NOT added to the '-removed' collection. [SINGLE]", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				expect(offlineSyncStore.getCount()).toEqual(2);

				var personRecord = me.getNewPersonRecord();

				// add and sync new record
				offlineSyncStore.add(personRecord);
				offlineSyncStore.sync();

				// new record is in store
				expect(offlineSyncStore.getCount()).toEqual(3);

				// check new record is in '-created' collection
				var createdCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-created');
				expect(createdCollection).toEqual(Ext.encode([personRecord.data]));

				// update and sync new record
				offlineSyncStore.remove(personRecord);
				offlineSyncStore.sync();

				// new record is not in store
				expect(offlineSyncStore.getCount()).toEqual(2);

				// check new record is NOT in '-created' collection
				var createdCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-created');
				expect(createdCollection).toEqual(Ext.encode([]));

				// check new record is NOT in '-removed' collection
				var removedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-removed');
				expect(removedCollection).toEqual(Ext.encode([]));

			});
		});

		it("(6) Updated record is added to '-updated' collection. When deleted it is removed from the '-updated' collection and added to the '-removed' collection. [SINGLE]", function(){
			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				expect(offlineSyncStore.getCount()).toEqual(2);

				var personRecord = offlineSyncStore.getAt(0);

				// make update and sync
				personRecord.set('FirstName', 'UPDATED FIRSTNAME FIELD');
				offlineSyncStore.sync();

				// record remains in the store
				expect(offlineSyncStore.getCount()).toEqual(2);

				// record is added to '-updated' collection
				var updatedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-updated');
				expect(updatedCollection).toEqual(Ext.encode([personRecord.data]));

				// remove the record and sync
				offlineSyncStore.remove(personRecord);
				offlineSyncStore.sync();

				// record is removed from the store
				expect(offlineSyncStore.getCount()).toEqual(1);

				// record is removed from '-updated' collection
				updatedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-updated');
				expect(updatedCollection).toEqual(Ext.encode([]));

				// record is added to the '-removed' collection
				var removedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-removed');
				expect(removedCollection).toEqual(Ext.encode([personRecord.data]));

			});
		});

		/**
		 * These tests are done with multiple records in each offline collection already to ensure that records are picked out correctly.
		 */
		it("(7) Added record is added to '-created' collection in localStorage and added to the store [MULTIPLE]", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				expect(offlineSyncStore.getCount()).toEqual(2);

				var personRecord = me.getNewPersonRecord();

				// add and sync 1st new record
				offlineSyncStore.add(personRecord);
				offlineSyncStore.sync();

				// check it's added to the store
				expect(offlineSyncStore.getCount()).toEqual(3);

				// check '-created' collection contains new record's data
				var createdCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-created');
				expect(createdCollection).toEqual(Ext.encode([personRecord.data]));


				var personRecord2 = me.getNewPersonRecord();

				// add and sync 2nd new record
				offlineSyncStore.add(personRecord2);
				offlineSyncStore.sync();

				// check it's added to the store
				expect(offlineSyncStore.getCount()).toEqual(4);

				// check '-created' collection contains both records' data
				var createdCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-created');
				expect(createdCollection).toEqual(Ext.encode([personRecord.data, personRecord2.data]));

			});
		});

		it("(8) Updated record is added to '-updated' collection in localStorage and updated in the store [MULTIPLE]", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				expect(offlineSyncStore.getCount()).toEqual(2);

				// get the record to update
				var personRecord = offlineSyncStore.getAt(0);

				// update & sync the record
				personRecord.set('FirstName', 'UPDATED FIRSTNAME FIELD');
				offlineSyncStore.sync();

				// check it's still in the store
				expect(offlineSyncStore.getCount()).toEqual(2);

				// check '-updated' collection contains updated record's data
				var updatedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-updated');
				expect(updatedCollection).toEqual(Ext.encode([personRecord.data]));

				// get 2nd record to update
				var personRecord2 = offlineSyncStore.getAt(1);

				// update and sync 2nd record
				personRecord2.set('FirstName', 'UPDATED FIRSTNAME FIELD 2');
				offlineSyncStore.sync();

				expect(offlineSyncStore.getCount()).toEqual(2);

				// check '-updated' collection contains both updated records' data
				var updatedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-updated');
				expect(updatedCollection).toEqual(Ext.encode([personRecord.data, personRecord2.data]));

			});
		});

		it("(9) Added record is added to '-created' collection and after being updated remains in the '-created' collection and is not added to the '-updated' collection [MULTIPLE]", function(){
			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				expect(offlineSyncStore.getCount()).toEqual(2);

				/**
				 * First new Record START
				 */
				var personRecord = me.getNewPersonRecord();

				// add and sync 1st new record
				offlineSyncStore.add(personRecord);
				offlineSyncStore.sync();

				// check it's added to the store
				expect(offlineSyncStore.getCount()).toEqual(3);

				// check '-created' collection contains new record's data
				var createdCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-created');
				expect(createdCollection).toEqual(Ext.encode([personRecord.data]));
				/**
				 * First new Record END
				 */


				/**
				 * Second new Record START
				 */

				var personRecord2 = me.getNewPersonRecord();

				// add and sync 1st new record
				offlineSyncStore.add(personRecord2);
				offlineSyncStore.sync();

				// check it's added to the store
				expect(offlineSyncStore.getCount()).toEqual(4);

				// check '-created' collection contains both the new records' data
				var createdCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-created');
				expect(createdCollection).toEqual(Ext.encode([personRecord.data, personRecord2.data]));

				/**
				 * Second new Record END
				 */


				/**
				 * Updated Record START
				 */

				var personRecordUpdated = offlineSyncStore.getAt(0);

				personRecordUpdated.set('FirstName', 'NEW UPDATED FIRSTNAME');
				offlineSyncStore.sync();

				// check it's still in the store
				expect(offlineSyncStore.getCount()).toEqual(4);

				// check '-updated' collection contains the record's data
				var updatedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-updated');
				expect(updatedCollection).toEqual(Ext.encode([personRecordUpdated.data]));

				/**
				 * Updated Record END
				 */


				/**
				 * First Record Updated START
				 */
				personRecord.set('FirstName', 'ANOTHER UPDATED FIRSTNAME');
				offlineSyncStore.sync();

				// check it's still in the store
				expect(offlineSyncStore.getCount()).toEqual(4);

				// check '-created' collection contains both records' data
				var createdCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-created');
				expect(createdCollection).toEqual(Ext.encode([personRecord.data, personRecord2.data]));

				// check '-updated' collection contains only the existing record's updated data
				var updatedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-updated');
				expect(updatedCollection).toEqual(Ext.encode([personRecordUpdated.data]));
				/**
				 * First Record Updated END
				 */

			});

		});

		it("(10) Added record is added to '-created' collection. When deleted it is removed from the '-created' collection and NOT added to the '-removed' collection. [MULTIPLE]", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				expect(offlineSyncStore.getCount()).toEqual(2);

				/**
				 * First new Record START
				 */
				var personRecord = me.getNewPersonRecord();

				// add and sync 1st new record
				offlineSyncStore.add(personRecord);
				offlineSyncStore.sync();

				// check it's added to the store
				expect(offlineSyncStore.getCount()).toEqual(3);

				// check '-created' collection contains new record's data
				var createdCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-created');
				expect(createdCollection).toEqual(Ext.encode([personRecord.data]));
				/**
				 * First new Record END
				 */


				/**
				 * Second new Record START
				 */
				var personRecord2 = me.getNewPersonRecord();

				// add and sync 1st new record
				offlineSyncStore.add(personRecord2);
				offlineSyncStore.sync();

				// check it's added to the store
				expect(offlineSyncStore.getCount()).toEqual(4);

				// check '-created' collection contains both the new records' data
				var createdCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-created');
				expect(createdCollection).toEqual(Ext.encode([personRecord.data, personRecord2.data]));
				/**
				 * Second new Record END
				 */


				/**
				 * Removed Record START
				 */
				var personRecordRemoved = offlineSyncStore.getAt(0);

				offlineSyncStore.remove(personRecordRemoved);
				offlineSyncStore.sync();

				// check it's removed from the store
				expect(offlineSyncStore.getCount()).toEqual(3);

				// check '-removed' collection contains the record's data
				var removedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-removed');
				expect(removedCollection).toEqual(Ext.encode([personRecordRemoved.data]));
				/**
				 * Removed Record END
				 */


				/**
				 * First Record Remove START
				 */
				offlineSyncStore.remove(personRecord);
				offlineSyncStore.sync();

				// check it's still in the store
				expect(offlineSyncStore.getCount()).toEqual(2);

				// check '-created' collection contains only the 2nd added record's data
				var createdCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-created');
				expect(createdCollection).toEqual(Ext.encode([personRecord2.data]));

				// check '-removed' collection contains only the existing record's removed data
				var removedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-removed');
				expect(removedCollection).toEqual(Ext.encode([personRecordRemoved.data]));
				/**
				 * First Record Remove END
				 */



			});
		});

		it("(11) Updated record is added to '-updated' collection. When deleted it is removed from the '-updated' collection and added to the '-removed' collection. [MULTIPLE]", function(){
			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				expect(offlineSyncStore.getCount()).toEqual(2);


				/*
				 * 1st Updated Record START
				 */
				var personRecordUpdated = offlineSyncStore.getAt(0);

				personRecordUpdated.set('FirstName', '1st UPDATE');
				offlineSyncStore.sync();

				// check it's still in the store
				expect(offlineSyncStore.getCount()).toEqual(2);

				// check '-updated' collection contains the record's data
				var updatedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-updated');
				expect(updatedCollection).toEqual(Ext.encode([personRecordUpdated.data]));
				/**
				 * 1st Updated Record END
				 */


				/**
				 * 2nd Updated Record START
				 */
				var personRecordUpdated2 = offlineSyncStore.getAt(1);

				personRecordUpdated2.set('FirstName', '2nd UPDATE');
				offlineSyncStore.sync();

				// check it's still in the store
				expect(offlineSyncStore.getCount()).toEqual(2);

				// check '-updated' collection contains the record's data
				var updatedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-updated');
				expect(updatedCollection).toEqual(Ext.encode([personRecordUpdated.data, personRecordUpdated2.data]));
				/**
				 * 2nd Updated Record END
				 */


				// Remove 2nd updated record
				offlineSyncStore.remove(personRecordUpdated2);
				offlineSyncStore.sync();

				// check it's removed the store
				expect(offlineSyncStore.getCount()).toEqual(1);

				// check '-updated' collection contains the record's data
				var updatedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-updated');
				expect(updatedCollection).toEqual(Ext.encode([personRecordUpdated.data]));

				// check '-remove' collection contains the record's data
				var removedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-removed');
				expect(removedCollection).toEqual(Ext.encode([personRecordUpdated2.data]));

				// check it's removed the store
				expect(offlineSyncStore.getCount()).toEqual(1);

				// check '-updated' collection contains the record's data
				var updatedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-updated');
				expect(updatedCollection).toEqual(Ext.encode([personRecordUpdated.data]));

				// check '-remove' collection contains the record's data
				var removedCollection = localStorage.getItem(offlineSyncStore.getLocalProxy().getId() + '-removed');
				expect(removedCollection).toEqual(Ext.encode([personRecordUpdated2.data]));


			});
		});


	});

	describe("Person server save tests", function(){

		it("Created Records save successfully", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				// check 'hasPending' checks are correct
				expect(offlineSyncStore.hasPendingServerSync()).toEqual(false);
				expect(offlineSyncStore.hasPendingCreated()).toEqual(false);
				expect(offlineSyncStore.hasPendingUpdated()).toEqual(false);
				expect(offlineSyncStore.hasPendingRemoved()).toEqual(false);

				expect(offlineSyncStore.getCount()).toEqual(2);

				var personRecord = me.getNewPersonRecord();

				// add and locally sync the new record
				offlineSyncStore.add(personRecord);
				offlineSyncStore.sync();

				// check it's added
				expect(offlineSyncStore.getCount()).toEqual(3);

				// check 'hasPending' checks are correct
				expect(offlineSyncStore.hasPendingServerSync()).toEqual(true);
				expect(offlineSyncStore.hasPendingCreated()).toEqual(true);
				expect(offlineSyncStore.hasPendingUpdated()).toEqual(false);
				expect(offlineSyncStore.hasPendingRemoved()).toEqual(false);

				// create flag to determine if server sync has completed.
				var recordsSynced = false;

				// wait for records to sync
				waitsFor(function(){
					return recordsSynced;
				}, 'Person records did not sync', 10000);

				offlineSyncStore.on('write', function(store, operation){
					recordsSynced = true; // update flag

					var createdRecords = operation.getRecords();

					// check the right number of records were synced
					expect(createdRecords.length).toEqual(1);

					// check the synced record has a new ID value
					expect(Ext.isEmpty(createdRecords[0].get('PersonID'))).toEqual(false);
				}, this);

				offlineSyncStore.syncServer();

			});

		});

		it("Created Records save successfully [multiple]", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				// check 'hasPending' checks are correct
				expect(offlineSyncStore.hasPendingServerSync()).toEqual(false);
				expect(offlineSyncStore.hasPendingCreated()).toEqual(false);
				expect(offlineSyncStore.hasPendingUpdated()).toEqual(false);
				expect(offlineSyncStore.hasPendingRemoved()).toEqual(false);

				expect(offlineSyncStore.getCount()).toEqual(2);

				var personRecord = me.getNewPersonRecord();

				// add and locally sync the new record
				offlineSyncStore.add(personRecord);
				offlineSyncStore.sync();

				var personRecord2 = me.getNewPersonRecord();

				// add and locally sync the new record
				offlineSyncStore.add(personRecord2);
				offlineSyncStore.sync();


				// check it's added
				expect(offlineSyncStore.getCount()).toEqual(4);

				// check 'hasPending' checks are correct
				expect(offlineSyncStore.hasPendingServerSync()).toEqual(true);
				expect(offlineSyncStore.hasPendingCreated()).toEqual(true);
				expect(offlineSyncStore.hasPendingUpdated()).toEqual(false);
				expect(offlineSyncStore.hasPendingRemoved()).toEqual(false);


				// create flag to determine if server sync has completed.
				var recordsSynced = false;

				// wait for records to sync
				waitsFor(function(){
					return recordsSynced;
				}, 'Person records did not sync', 10000);


				// Sync 'unsynced' records with server.
				offlineSyncStore.on('write', function(store, operation){
					recordsSynced = true; // update flag

					var createdRecords = operation.getRecords();

					// check the right number of records were synced
					expect(createdRecords.length).toEqual(2);

					// check the synced record has a new ID value
					expect(Ext.isEmpty(createdRecords[0].get('PersonID'))).toEqual(false);
					expect(Ext.isEmpty(createdRecords[1].get('PersonID'))).toEqual(false);
				}, this);

				offlineSyncStore.syncServer();

			});

		});

		it("Updated Records save successfully", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				// check 'hasPending' checks are correct
				expect(offlineSyncStore.hasPendingServerSync()).toEqual(false);
				expect(offlineSyncStore.hasPendingCreated()).toEqual(false);
				expect(offlineSyncStore.hasPendingUpdated()).toEqual(false);
				expect(offlineSyncStore.hasPendingRemoved()).toEqual(false);

				expect(offlineSyncStore.getCount()).toEqual(2);

				var personRecord = offlineSyncStore.getAt(0);

				personRecord.set('FirstName', 'FIRST NAME UPDATE');

				offlineSyncStore.sync();

				// check it still has same count
				expect(offlineSyncStore.getCount()).toEqual(2);

				// check 'hasPending' checks are correct
				expect(offlineSyncStore.hasPendingServerSync()).toEqual(true);
				expect(offlineSyncStore.hasPendingCreated()).toEqual(false);
				expect(offlineSyncStore.hasPendingUpdated()).toEqual(true);
				expect(offlineSyncStore.hasPendingRemoved()).toEqual(false);


				// create flag to determine if server sync has completed.
				var recordsSynced = false;

				// wait for records to sync
				waitsFor(function(){
					return recordsSynced;
				}, 'Person records did not sync', 10000);

				offlineSyncStore.on('write', function(store, operation){
					recordsSynced = true; // update flag

					var updatedRecords = operation.getRecords();

					// check the right number of records were synced
					expect(updatedRecords.length).toEqual(1);

					// check the synced record has a new ID value
					expect(Ext.isEmpty(updatedRecords[0].get('PersonID'))).toEqual(false);
					expect(updatedRecords[0].get('FirstName')).toEqual('FIRST NAME UPDATE');
				}, this);

				offlineSyncStore.syncServer();

			});

		});

		it("Updated Records save successfully [multiple]", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				// check 'hasPending' checks are correct
				expect(offlineSyncStore.hasPendingServerSync()).toEqual(false);
				expect(offlineSyncStore.hasPendingCreated()).toEqual(false);
				expect(offlineSyncStore.hasPendingUpdated()).toEqual(false);
				expect(offlineSyncStore.hasPendingRemoved()).toEqual(false);

				expect(offlineSyncStore.getCount()).toEqual(2);

				var personRecord = offlineSyncStore.getAt(0);

				personRecord.set('FirstName', 'FIRST NAME UPDATE');

				offlineSyncStore.sync();

				expect(offlineSyncStore.getCount()).toEqual(2);

				// check 'hasPending' checks are correct
				expect(offlineSyncStore.hasPendingServerSync()).toEqual(true);
				expect(offlineSyncStore.hasPendingCreated()).toEqual(false);
				expect(offlineSyncStore.hasPendingUpdated()).toEqual(true);
				expect(offlineSyncStore.hasPendingRemoved()).toEqual(false);


				var personRecord2 = offlineSyncStore.getAt(1);

				personRecord2.set('FirstName', 'SECOND NAME UPDATE');

				offlineSyncStore.sync();

				expect(offlineSyncStore.getCount()).toEqual(2);

				// create flag to determine if server sync has completed.
				var recordsSynced = false;

				// wait for records to sync
				waitsFor(function(){
					return recordsSynced;
				}, 'Person records did not sync', 10000);


				// Sync 'unsynced' records with server.
				offlineSyncStore.on('write', function(store, operation){
					recordsSynced = true; // update flag

					var updatedRecords = operation.getRecords();

					// check the right number of records were synced
					expect(updatedRecords.length).toEqual(2);

					// check the synced record has a new ID value
					expect(Ext.isEmpty(updatedRecords[0].get('PersonID'))).toEqual(false);
					expect(Ext.isEmpty(updatedRecords[1].get('PersonID'))).toEqual(false);

					expect(updatedRecords[0].get('FirstName')).toEqual('FIRST NAME UPDATE');
					expect(updatedRecords[1].get('FirstName')).toEqual('SECOND NAME UPDATE');

				}, this);

				offlineSyncStore.syncServer();

			});

		});

		it("Removed Records save successfully", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				// check 'hasPending' checks are correct
				expect(offlineSyncStore.hasPendingServerSync()).toEqual(false);
				expect(offlineSyncStore.hasPendingCreated()).toEqual(false);
				expect(offlineSyncStore.hasPendingUpdated()).toEqual(false);
				expect(offlineSyncStore.hasPendingRemoved()).toEqual(false);

				expect(offlineSyncStore.getCount()).toEqual(2);

				offlineSyncStore.removeAt(0);

				offlineSyncStore.sync();

				expect(offlineSyncStore.getCount()).toEqual(1);

				// check 'hasPending' checks are correct
				expect(offlineSyncStore.hasPendingServerSync()).toEqual(true);
				expect(offlineSyncStore.hasPendingCreated()).toEqual(false);
				expect(offlineSyncStore.hasPendingUpdated()).toEqual(false);
				expect(offlineSyncStore.hasPendingRemoved()).toEqual(true);


				// create flag to determine if server sync has completed.
				var recordsSynced = false;

				// wait for records to sync
				waitsFor(function(){
					return recordsSynced;
				}, 'Person records did not sync', 10000);


				// Sync 'unsynced' records with server.
				offlineSyncStore.on('write', function(store, operation){
					recordsSynced = true; // update flag

					var deletedRecords = operation.getRecords();

					// check the right number of records were synced
					expect(deletedRecords.length).toEqual(1);

					// check the synced record has a new ID value
					expect(Ext.isEmpty(deletedRecords[0].get('PersonID'))).toEqual(false);

					expect(deletedRecords[0].get('FirstName')).toEqual('Stuart');

				}, this);

				offlineSyncStore.syncServer();

			});

		});


		it("Removed Records save successfully [multiple]", function(){

			var offlineSyncStore = me.createAndLoadPersonStore();

			runs(function(){

				// check 'hasPending' checks are correct
				expect(offlineSyncStore.hasPendingServerSync()).toEqual(false);
				expect(offlineSyncStore.hasPendingCreated()).toEqual(false);
				expect(offlineSyncStore.hasPendingUpdated()).toEqual(false);
				expect(offlineSyncStore.hasPendingRemoved()).toEqual(false);

				expect(offlineSyncStore.getCount()).toEqual(2);

				offlineSyncStore.removeAt(0);

				offlineSyncStore.sync();

				expect(offlineSyncStore.getCount()).toEqual(1);


				offlineSyncStore.removeAt(0);

				offlineSyncStore.sync();

				expect(offlineSyncStore.getCount()).toEqual(0);

				// check 'hasPending' checks are correct
				expect(offlineSyncStore.hasPendingServerSync()).toEqual(true);
				expect(offlineSyncStore.hasPendingCreated()).toEqual(false);
				expect(offlineSyncStore.hasPendingUpdated()).toEqual(false);
				expect(offlineSyncStore.hasPendingRemoved()).toEqual(true);


				// create flag to determine if server sync has completed.
				var recordsSynced = false;

				// wait for records to sync
				waitsFor(function(){
					return recordsSynced;
				}, 'Person records did not sync', 10000);


				// Sync 'unsynced' records with server.
				offlineSyncStore.on('write', function(store, operation){
					recordsSynced = true; // update flag

					var updatedRecords = operation.getRecords();

					// check the right number of records were synced
					expect(updatedRecords.length).toEqual(2);

					// check the synced record has a new ID value
					expect(Ext.isEmpty(updatedRecords[0].get('PersonID'))).toEqual(false);
					expect(Ext.isEmpty(updatedRecords[1].get('PersonID'))).toEqual(false);

					expect(updatedRecords[0].get('FirstName')).toEqual('Andrew');
					expect(updatedRecords[1].get('FirstName')).toEqual('Stuart');

				}, this);

				offlineSyncStore.syncServer();

			});

		});



	});

});