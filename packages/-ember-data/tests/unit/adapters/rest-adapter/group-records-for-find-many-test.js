import { run } from '@ember/runloop';

import { module, test } from 'qunit';
import { Promise as EmberPromise } from 'rsvp';

import { setupTest } from 'ember-qunit';

import RESTAdapter from '@ember-data/adapter/rest';
import Model from '@ember-data/model';
import RESTSerializer from '@ember-data/serializer/rest';

let store, requests;
let maxLength;
let lengths;

module(
  'unit/adapters/rest_adapter/group_records_for_find_many_test - DS.RESTAdapter#groupRecordsForFindMany',
  function (hooks) {
    setupTest(hooks);

    hooks.beforeEach(function () {
      maxLength = -1;
      requests = [];
      lengths = [];

      class ApplicationAdapter extends RESTAdapter {
        coalesceFindRequests = true;

        findRecord(store, type, id, snapshot) {
          return { id };
        }

        ajax(url, type, options) {
          requests.push({
            url,
            ids: options.data.ids,
          });

          let queryString = options.data.ids
            .map((i) => {
              return encodeURIComponent('ids[]') + '=' + encodeURIComponent(i);
            })
            .join('&');
          let fullUrl = url + '?' + queryString;

          maxLength = this.get('maxURLLength');
          lengths.push(fullUrl.length);

          let testRecords = options.data.ids.map((id) => ({ id }));
          return EmberPromise.resolve({ testRecords: testRecords });
        }
      }

      this.owner.register('adapter:application', ApplicationAdapter);
      this.owner.register('serializer:application', RESTSerializer.extend());
      this.owner.register('model:test-record', Model.extend());

      store = this.owner.lookup('service:store');
    });

    test('groupRecordsForFindMany - findMany', function (assert) {
      let wait = [];
      run(() => {
        for (var i = 1; i <= 1024; i++) {
          wait.push(store.findRecord('testRecord', i));
        }
      });

      assert.ok(
        lengths.every((len) => len <= maxLength),
        `Some URLs are longer than ${maxLength} chars`
      );
      return EmberPromise.all(wait);
    });

    test('groupRecordsForFindMany works for encodeURIComponent-ified ids', function (assert) {
      let wait = [];
      run(() => {
        wait.push(store.findRecord('testRecord', 'my-id:1'));
        wait.push(store.findRecord('testRecord', 'my-id:2'));
      });

      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, '/testRecords');
      assert.deepEqual(requests[0].ids, ['my-id:1', 'my-id:2']);

      return EmberPromise.all(wait);
    });

    test('_stripIDFromURL works with id being encoded - #4190', function (assert) {
      let record = store.createRecord('testRecord', { id: 'id:123' });
      let adapter = store.adapterFor('testRecord');
      let snapshot = record._internalModel.createSnapshot();
      let strippedUrl = adapter._stripIDFromURL(store, snapshot);

      assert.equal(strippedUrl, '/testRecords/');
    });
  }
);
