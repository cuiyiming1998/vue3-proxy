import { extend } from '../shared'

let activeEffect // 代表当前的副作用对象 ReactiveEffect
let shouldTrack // 代表当前是否需要 track 收集依赖
export class ReactiveEffect {
	private _fn: any
	public schedular: Function | undefined
  public active: boolean = true
	public deps: any[]
  public onStop?: () => void
	constructor(_fn, schedular?) {
		this.deps = []
		this._fn = _fn
		this.schedular = schedular
	}

	run() {
		activeEffect = this
    if (!this.active) {
      return this._fn()
    }
    shouldTrack = true
    activeEffect = this
    const result = this._fn()
    shouldTrack = false

    return result
	}

	stop() {
    if (this.active) {
      cleanupEffect(this)
      if (this.onStop) {
        this.onStop()
      }
      this.active = false
    }
	}
}

function cleanupEffect(effect) {
	effect.deps.forEach((dep: any) => {
		dep.delete(effect)
	})
  effect.deps.length = 0
}

const targetMap = new Map()
export function track(target, key) {
  if (!isTracking()) {
    return
  }
	let depsMap = targetMap.get(target)
	if (!depsMap) {
		targetMap.set(target, (depsMap = new Map()))
	}

	let dep = depsMap.get(key)
	if (!dep) {
		depsMap.set(key, (dep = new Set()))
	}

  trackEffects(dep)
}

export function trackEffects(dep) {
  if (dep.has(activeEffect)) {
    return
  }
  dep.add(activeEffect)
  activeEffect.deps.push(dep)
}
/*
  * 没有被 effect 包裹时，由于没有副作用函数（即没有依赖，activeEffect === undefined），不应该收集依赖
  * 某些特殊情况，即使包裹在 effect，也不应该收集依赖（即 shouldTrack === false）。如：组件生命周期执行、组件 setup 执行
*/
export function isTracking() {
  return shouldTrack && undefined !== activeEffect
}

export function trigger(target, key) {
	let depsMap = targetMap.get(target)
	let dep = depsMap.get(key)
  triggerEffects(dep)
}
export function triggerEffects(dep) {
  for (const effect of dep) {
		if (effect.schedular) {
			effect.schedular()
		} else {
			effect.run()
		}
	}
}
export function effect(fn, options: any = {}) {
	const _effect = new ReactiveEffect(fn, options.schedular)
  extend(_effect, options)
	_effect.run()

	const runner: any = _effect.run.bind(_effect)
	runner.effect = _effect

	return runner
}

export function stop(runner) {
	runner.effect.stop()
}
