export const hasOwn = Object.hasOwn;

export const isArray = Array.isArray;

export const ObjectToString = (value) => Object.prototype.toString.call(value);

export const isObject = (value) => ObjectToString(value) === '[object Object]';

export const isFunction = (value) => typeof value === 'function';
