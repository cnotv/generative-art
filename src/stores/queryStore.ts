import { defineStore } from 'pinia';
import type { LocationQueryRaw } from 'vue-router';

export const useQueryStore = defineStore('query', {
  state: () => ({
    query: {} as LocationQueryRaw
  }),
  actions: {
    setQuery(newQuery: LocationQueryRaw) {
      this.query = { ...this.query, ...newQuery };
    }
  }
});
