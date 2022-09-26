'use strict'

import sinon from 'sinon'
import engineFactory from '../src/index'

describe('Engine: "if-then" conditions', () => {
  let engine
  let sandbox
  before(() => {
    sandbox = sinon.createSandbox()
  })
  afterEach(() => {
    sandbox.restore()
  })

  const conditions = {
      if : {
      fact: 'enabled',
      operator: 'equal',
      value: true
      },
      then: {
      all: [{
          fact: 'age',
          operator: 'lessThan',
          value: 50
      }, {
          fact: 'segment',
          operator: 'equal',
          value: 'european'
      }]
      }
  }
  const event = {
      type: 'ageTrigger',
      params: {
      demographic: 'under50'
      }
  }
  let eventSpy
  let enabled
  let ageSpy
  let segmentSpy
  beforeEach(() => {
      eventSpy = sandbox.spy()
      enabled = sandbox.stub()
      ageSpy = sandbox.stub()
      segmentSpy = sandbox.stub()
      const rule = factories.rule({ conditions, event })
      engine = engineFactory()
      engine.addRule(rule)
      engine.addFact('enabled', enabled)
      engine.addFact('segment', segmentSpy)
      engine.addFact('age', ageSpy)
      engine.on('success', eventSpy)
  })

  it('enabled is false - succeeds no matter of "then"', async () => {
      enabled.returns(false)

      segmentSpy.returns('north-american')
      ageSpy.returns(25)
      await engine.run()
      expect(eventSpy).to.have.been.calledWith(event)

      segmentSpy.returns('european')
      ageSpy.returns(100)
      await engine.run()
      expect(eventSpy).to.have.been.calledWith(event)

      segmentSpy.returns('north-american')
      ageSpy.returns(100)
      await engine.run()
      expect(eventSpy).to.have.been.calledWith(event)

      segmentSpy.returns('european')
      ageSpy.returns(25)
      await engine.run()
      expect(eventSpy).to.have.been.calledWith(event)
  })

  it('enabled is true - then should fail', async () => {
      enabled.returns(true)

      segmentSpy.returns('north-american')
      ageSpy.returns(25)
      await engine.run()
      expect(eventSpy).to.not.have.been.calledWith(event)

      segmentSpy.returns('european')
      ageSpy.returns(100)
      await engine.run()
      expect(eventSpy).to.not.have.been.calledWith(event)

      segmentSpy.returns('north-american')
      ageSpy.returns(100)
      await engine.run()
      expect(eventSpy).to.not.have.been.calledWith(event)
  })

  it('enabled is true - then should succeed', async () => {
      enabled.returns(true)

      segmentSpy.returns('european')
      ageSpy.returns(25)
      await engine.run()
      expect(eventSpy).to.have.been.calledWith(event)
  })
})
