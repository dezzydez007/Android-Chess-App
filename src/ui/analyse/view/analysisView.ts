import h from 'mithril/hyperscript'
import i18n, { plural } from '../../../i18n'
import { handleXhrError } from '../../../utils'
import { shallowEqual } from '../../../utils/object'
import redraw from '../../../utils/redraw'
import { batchRequestAnimationFrame } from '../../../utils/batchRAF'
import * as gameApi from '../../../lichess/game'
import spinner from '../../../spinner'
import { playerName } from '../../../lichess/player'
import { AnalyseData, RemoteEvalSummary } from '../../../lichess/interfaces/analyse'
import { Study, findTag } from '../../../lichess/interfaces/study'
import * as helper from '../../helper'

import { requestComputerAnalysis } from '../analyseXhr'
import AnalyseCtrl from '../AnalyseCtrl'
import drawAcplChart from '../charts/acpl'
import drawMoveTimesChart from '../charts/moveTimes'

export default function renderAnalysis(ctrl: AnalyseCtrl): Mithril.Child {
  const d = ctrl.data

  return h('div.analyse-gameAnalysis.native_scroller', [
    d.analysis ? renderAnalysisGraph(ctrl) :
      ctrl.study ? renderStudyAnalysisRequest(ctrl) : renderGameAnalysisRequest(ctrl),
    d.game.moveCentis ? renderMoveTimes(ctrl, d.game.moveCentis) : null
  ])
}

function renderAnalysisGraph(ctrl: AnalyseCtrl) {
  return h('div.analyse-computerAnalysis', [
    h('strong.title', i18n('computerAnalysis')),
    ctrl.analysisProgress ?
    h('div.analyse-gameAnalysis_chartPlaceholder', spinner.getVdom('monochrome')) :
    h('div.analyse-chart', {
      oncreate({ dom }: Mithril.VnodeDOM) {
        batchRequestAnimationFrame(() => {
          this.updateCurPly = drawAcplChart(dom as HTMLElement, ctrl.data, ctrl.node.ply)
        })
      },
      onupdate({ dom }: Mithril.VnodeDOM) {
        if (this.updateCurPly) {
          batchRequestAnimationFrame(() => {
            this.updateCurPly(ctrl.onMainline ? ctrl.node.ply : null)
          })
        } else {
          batchRequestAnimationFrame(() => {
            const el = dom as HTMLElement
            while (el.lastElementChild) {
              el.removeChild(el.lastElementChild)
            }
            this.updateCurPly = drawAcplChart(el, ctrl.data, ctrl.node.ply)
          })
        }
      }
    }),
    h(AcplSummary, {
      d: ctrl.data,
      analysis: ctrl.data.analysis!,
      study: ctrl.study && ctrl.study.data
    })
  ])
}

const AcplSummary: Mithril.Component<{
  d: AnalyseData
  analysis: RemoteEvalSummary
  study?: Study
}> = {
  onbeforeupdate({ attrs }, { attrs: oldattrs }) {
    return !shallowEqual(attrs.analysis, oldattrs.analysis)
  },

  view({ attrs }) {
    const { d, analysis, study } = attrs

    const colors: [Color, Color] = ['white', 'black']
    return h('div.analyse-evalSummary', colors.map((color: Color) => {
      const p = gameApi.getPlayer(d, color)
      const pName = study ? findTag(study, color) || 'Anonymous' : playerName(p)

      return h('div.analyse-evalSummary__side', [
        h('div.analyse-evalSummary__player', [
          h('span.color-icon.' + color),
          h('span', [pName, p ? helper.renderRatingDiff(p) : null])
        ]),
        h('div', [
          advices.map(a => {
            const nb = analysis && analysis[color][a[0]]
            return h('div.analyse-evalSummary__summary', [
              h.trust(plural(a[1], nb, `<strong>${nb}</strong>`)),
            ])
          }),
          h('div.analyse-evalSummary__summary', [
            h('strong', analysis && analysis[color].acpl),
            h('span', i18n('averageCentipawnLoss'))
          ])
        ])
      ])
    }))
  }
}

function renderGameAnalysisRequest(ctrl: AnalyseCtrl) {
  return h('div.analyse-computerAnalysis.request', [
    ctrl.analysisProgress ? h('div.analyse-requestProgress', [
      h('span', i18n('waitingForAnalysis')),
      spinner.getVdom('monochrome')
    ]) : h('button.fatButton', {
      oncreate: helper.ontapXY(() => {
        return requestComputerAnalysis(ctrl.data.game.id)
        .then(() => {
          ctrl.analysisProgress = true
          redraw()
        })
        .catch(handleXhrError)
      })
    }, [i18n('requestAComputerAnalysis')])
  ])
}

function renderStudyAnalysisRequest(ctrl: AnalyseCtrl) {
  return h('div.analyse-computerAnalysis.request', ctrl.mainline.length < 5 ? h('p', 'The study is too short to be analysed.') :
      !ctrl.study!.canContribute() ? h('p', 'Only the study contributors can request a computer analysis') : [
        h('p', [
          'Get a full server-side computer analysis of the main line.',
          h('br'),
          'Make sure the chapter is complete, for you can only request analysis once.'
        ]),
        ctrl.analysisProgress ? h('div.analyse-requestProgress', [
          h('span', i18n('waitingForAnalysis')),
          spinner.getVdom('monochrome')
        ]) : h('button.fatButton', {
          oncreate: helper.ontapXY(() => {
            ctrl.socket.send('requestAnalysis', ctrl.study!.data.chapter.id)
            ctrl.analysisProgress = true
            redraw()
          })
        }, [i18n('requestAComputerAnalysis')])
    ]
  )
}

function renderMoveTimes(ctrl: AnalyseCtrl, moveCentis: number[]) {
  return h('div.analyse-moveTimes', [
    h('strong.title', i18n('moveTimes')),
    h('div.analyse-chart', {
      oncreate({ dom }: Mithril.VnodeDOM<any, any>) {
        setTimeout(() => {
          this.updateCurPly = drawMoveTimesChart(dom as HTMLElement, ctrl.data, moveCentis, ctrl.node.ply)
        }, 200)
      },
      onupdate() {
        if (this.updateCurPly) batchRequestAnimationFrame(() => {
          if (ctrl.onMainline) this.updateCurPly(ctrl.node.ply)
          else this.updateCurPly(null)
        })
      }
    })
  ])
}

const advices = [
  ['inaccuracy', 'nbInaccuracies'],
  ['mistake', 'nbMistakes'],
  ['blunder', 'nbBlunders']
]
