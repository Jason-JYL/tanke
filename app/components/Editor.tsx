import { match, Route, Redirect } from 'react-router-dom'
import { replace, goBack } from 'react-router-redux'
import React from 'react'
import { Dispatch } from 'redux'
import { is, List, Repeat } from 'immutable'
import { connect } from 'react-redux'
import {
  BLOCK_SIZE as B,
  FIELD_BLOCK_SIZE as FBZ,
  ZOOM_LEVEL,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
} from 'utils/constants'
import Eagle from 'components/Eagle'
import Text from 'components/Text'
import River from 'components/River'
import Snow from 'components/Snow'
import Forest from 'components/Forest'
import { Tank } from 'components/tanks'
import BrickWall from 'components/BrickWall'
import SteelWall from 'components/SteelWall'
import TextInput from 'components/TextInput'
import TextButton from 'components/TextButton'
import { TankRecord, StageDifficulty, StageConfig, State } from 'types/index'
import { add, dec, inc } from 'utils/common'
import Popup from '../types/Popup'
import AreaButton from './AreaButton'
import Grid from './Grid'
import Screen from './Screen'
import StagePreview from './StagePreview'
import {
  defaultEnemiesConfig,
  MapItemType,
  MapItem,
  StageConfigConverter,
} from '../types/StageConfig'
import TextWithLineWrap from './TextWithLineWrap'

const HexBrickWall = ({ x, y, hex }: { x: number; y: number; hex: number }) => (
  <g className="hex-brick-wall">
    {[[0b0001, 0, 0], [0b0010, 8, 0], [0b0100, 0, 8], [0b1000, 8, 8]].map(
      ([mask, dx, dy], index) => (
        <g
          key={index}
          style={{ opacity: hex & mask ? 1 : 0.3 }}
          transform={`translate(${dx},${dy})`}
        >
          <BrickWall x={x} y={y} />
          <BrickWall x={x + 4} y={y} />
          <BrickWall x={x} y={y + 4} />
          <BrickWall x={x + 4} y={y + 4} />
        </g>
      ),
    )}
  </g>
)

const HexSteelWall = ({ x, y, hex }: { x: number; y: number; hex: number }) => (
  <g className="hex-steel-wall">
    <g style={{ opacity: hex & 0b0001 ? 1 : 0.3 }}>
      <SteelWall x={x} y={y} />
    </g>
    <g style={{ opacity: hex & 0b0010 ? 1 : 0.3 }}>
      <SteelWall x={x + 8} y={y} />
    </g>
    <g style={{ opacity: hex & 0b0100 ? 1 : 0.3 }}>
      <SteelWall x={x} y={y + 8} />
    </g>
    <g style={{ opacity: hex & 0b1000 ? 1 : 0.3 }}>
      <SteelWall x={x + 8} y={y + 8} />
    </g>
  </g>
)

const positionMap = {
  X: B,
  B: 2.5 * B,
  T: 4 * B,
  R: 5.5 * B,
  S: 7 * B,
  F: 8.5 * B,
  E: 10 * B,
}

export interface EditorProps {
  match: match<any>
  dispatch: Dispatch<State>
  initialCotnent: StageConfig
  stages: List<StageConfig>
}

class Editor extends React.Component<EditorProps> {
  private svg: SVGSVGElement
  private pressed = false
  private resolveConfirm: (ok: boolean) => void = null
  private resolveAlert: () => void = null

  state = {
    popup: null as Popup,
    t: -1,

    name: '',
    difficulty: 1 as StageDifficulty,
    enemies: defaultEnemiesConfig,

    itemList: Repeat(new MapItem(), FBZ ** 2).toList(),
    itemType: 'X' as MapItemType,
    brickHex: 0xf,
    steelHex: 0xf,
  }

  componentDidMount() {
    // custom 在这里不需要取出来，因为 custom 永远为 true
    const { name, difficulty, itemList, enemies } = StageConfigConverter.s2e(
      this.props.initialCotnent,
    )
    this.setState({ name, difficulty, itemList, enemies })
  }

  getT(event: React.MouseEvent<SVGSVGElement>) {
    let totalTop = 0
    let totalLeft = 0
    let node: Element = this.svg
    while (node) {
      totalTop += node.scrollTop + node.clientTop
      totalLeft += node.scrollLeft + node.clientLeft
      node = node.parentElement
    }
    const row = Math.floor((event.clientY + totalTop - this.svg.clientTop) / ZOOM_LEVEL / B)
    const col = Math.floor((event.clientX + totalLeft - this.svg.clientLeft) / ZOOM_LEVEL / B)
    if (row >= 0 && row < FBZ && col >= 0 && col < FBZ) {
      return row * FBZ + col
    } else {
      return -1
    }
  }

  getCurrentItem() {
    const { itemType, brickHex, steelHex } = this.state
    if (itemType === 'B') {
      return new MapItem({ type: 'B', hex: brickHex })
    } else if (itemType === 'T') {
      return new MapItem({ type: 'T', hex: steelHex })
    } else {
      return new MapItem({ type: itemType })
    }
  }

  setAsCurrentItem(t: number) {
    const { itemList } = this.state
    const item = this.getCurrentItem()
    if (t == -1 || is(itemList.get(t), item)) {
      return
    }
    if (item.type === 'E') {
      // 先将已存在的eagle移除 保证Eagle最多出现一次
      const eagleRemoved = itemList.map(item => (item.type === 'E' ? new MapItem() : item))
      this.setState({ itemList: eagleRemoved.set(t, item) })
    } else {
      this.setState({ itemList: itemList.set(t, item) })
    }
  }

  onMouseDown = (view: string, event: React.MouseEvent<SVGSVGElement>) => {
    const { popup } = this.state
    if (view === 'map' && popup == null && this.getT(event) !== -1) {
      this.pressed = true
    }
  }

  onMouseMove = (view: string, event: React.MouseEvent<SVGSVGElement>) => {
    const { popup, t: lastT } = this.state
    const t = this.getT(event)
    if (t !== lastT) {
      this.setState({ t })
    }
    if (view === 'map' && popup == null && this.pressed) {
      this.setAsCurrentItem(t)
    }
  }

  onMouseUp = (view: string, event: React.MouseEvent<SVGSVGElement>) => {
    this.pressed = false
    const { popup } = this.state
    if (view === 'map' && popup == null) {
      this.setAsCurrentItem(this.getT(event))
    }
  }

  onMouseLeave = () => {
    this.pressed = false
    this.setState({ t: -1 })
  }

  onIncDifficulty = () => {
    const { difficulty } = this.state
    this.setState({ difficulty: difficulty + 1 })
  }

  onDecDifficulty = () => {
    const { difficulty } = this.state
    this.setState({ difficulty: difficulty - 1 })
  }

  onIncEnemyLevel = (index: number) => {
    const { enemies } = this.state
    this.setState({
      enemies: enemies.update(index, e => e.incTankLevel()),
    })
  }

  onDecEnemyLevel = (index: number) => {
    const { enemies } = this.state
    this.setState({
      enemies: enemies.update(index, e => e.decTankLevel()),
    })
  }

  onIncEnemyCount = (index: number) => {
    const { enemies } = this.state
    this.setState({
      enemies: enemies.updateIn([index, 'count'], inc(1)),
    })
  }

  onDecEnemyCount = (index: number) => {
    const { enemies } = this.state
    this.setState({
      enemies: enemies.updateIn([index, 'count'], dec(1)),
    })
  }

  /** 检查当前编辑器中的关卡配置是否合理. 返回 true 表示关卡配置合理 */
  async check() {
    const { stages } = this.props
    const { name, enemies, itemList } = this.state
    const totalEnemyCount = enemies.map(e => e.count).reduce(add)

    // 检查stageName
    if (name === '') {
      await this.showAlertPopup('Please enter stage name.')
      this.props.dispatch(replace('/editor/config'))
      return false
    }

    // 检查是否与已有的default-stage 重名
    if (stages.some(s => !s.custom && s.name === name)) {
      await this.showAlertPopup(`Stage ${name} already exists.`)
      return false
    }

    // 检查enemies数量
    if (totalEnemyCount === 0) {
      await this.showAlertPopup('no enemy')
      return false
    }

    // 检查老鹰是否存在
    const hasEagle = itemList.some(mapItem => mapItem.type === 'E')
    if (!hasEagle) {
      await this.showAlertPopup('no eagle.')
      return false
    }

    // 检查是否与已有的custom-stage 重名
    if (stages.some(s => s.custom && s.name === name)) {
      const confirmed = await this.showConfirmPopup('Override exsiting custome stage. continue?')
      if (!confirmed) {
        return false
      }
    }

    if (totalEnemyCount !== 20) {
      const confirmed = await this.showConfirmPopup('total enemy count is not 20. continue?')
      if (!confirmed) {
        return false
      }
    }

    return true
  }

  onBack = async () => {
    const { dispatch } = this.props
    dispatch<Action>({ type: 'SET_EDITOR_CONTENT', stage: this.getStage() })
    dispatch(goBack())
  }

  onSave = async () => {
    if (await this.check()) {
      const { dispatch } = this.props
      const stage = StageConfigConverter.e2s(Object.assign({ custom: true }, this.state))
      dispatch<Action>({ type: 'SET_CUSTOM_STAGE', stage })
      dispatch<Action>({ type: 'SYNC_CUSTOM_STAGES' })
      dispatch(replace('/list/custom'))
    }
  }

  showAlertPopup(message: string) {
    this.setState({
      popup: new Popup({ type: 'alert', message }),
    })
    return new Promise<boolean>(resolve => {
      this.resolveAlert = resolve
    })
  }

  showConfirmPopup(message: string) {
    this.setState({
      popup: new Popup({ type: 'confirm', message }),
    })
    return new Promise<boolean>(resolve => {
      this.resolveConfirm = resolve
    })
  }

  onConfirm = () => {
    this.resolveConfirm(true)
    this.resolveConfirm = null
    this.setState({ popup: null })
  }

  onCancel = () => {
    this.resolveConfirm(false)
    this.resolveConfirm = null
    this.setState({ popup: null })
  }

  onClickOkOfAlert = () => {
    this.resolveAlert()
    this.resolveAlert = null
    this.setState({ popup: null })
  }

  onShowHelpInfo = async () => {
    await this.showAlertPopup('1. Choose an item type below.')
    await this.showAlertPopup('2. Click or pan in the left.')
    await this.showAlertPopup('3. After selecting Brick or Steel you can change the item shape')
  }

  getStage() {
    return StageConfigConverter.e2s(Object.assign({ custom: false }, this.state))
  }

  renderItemSwitchButtons() {
    return (
      <g className="item-switch-buttons">
        {Object.entries(positionMap).map(([type, y]: [MapItemType, number]) => (
          <AreaButton
            key={type}
            x={0.25 * B}
            y={y}
            width={2.5 * B}
            height={B}
            onClick={() => this.setState({ itemType: type })}
          />
        ))}
      </g>
    )
  }

  renderHexAdjustButtons() {
    const { itemType, brickHex, steelHex } = this.state
    let brickHexAdjustButtons: JSX.Element[] = null
    let steelHexAdjustButtons: JSX.Element[] = null

    if (itemType === 'B') {
      brickHexAdjustButtons = [0b0001, 0b0010, 0b0100, 0b1000].map(bin => (
        <AreaButton
          key={bin}
          x={B + (bin & 0b1010 ? 0.5 * B : 0)}
          y={2.5 * B + (bin & 0b1100 ? 0.5 * B : 0)}
          width={0.5 * B}
          height={0.5 * B}
          spreadX={0}
          spreadY={0}
          onClick={() => this.setState({ brickHex: brickHex ^ bin })}
        />
      ))
    }
    if (itemType === 'T') {
      steelHexAdjustButtons = [0b0001, 0b0010, 0b0100, 0b1000].map(bin => (
        <AreaButton
          key={bin}
          x={B + (bin & 0b1010 ? 0.5 * B : 0)}
          y={4 * B + (bin & 0b1100 ? 0.5 * B : 0)}
          width={0.5 * B}
          height={0.5 * B}
          spreadX={0}
          spreadY={0}
          onClick={() => this.setState({ steelHex: steelHex ^ bin })}
        />
      ))
    }
    return (
      <g className="hex-adjust-buttons">
        {brickHexAdjustButtons}
        {steelHexAdjustButtons}
        {itemType === 'B' ? (
          <TextButton
            content="f"
            spreadX={0.125 * B}
            x={2.25 * B}
            y={2.75 * B}
            onClick={() => this.setState({ itemType: 'B', brickHex: 0xf })}
          />
        ) : null}
        {itemType === 'T' ? (
          <TextButton
            content="f"
            spreadX={0.125 * B}
            x={2.25 * B}
            y={4.25 * B}
            onClick={() => this.setState({ itemType: 'T', steelHex: 0xf })}
          />
        ) : null}
      </g>
    )
  }

  renderMapView() {
    const { brickHex, steelHex, itemType, t } = this.state

    return (
      <g className="map-view">
        <StagePreview disableImageCache stage={this.getStage()} />
        <Grid t={t} />
        <g className="tools" transform={`translate(${13 * B},0)`}>
          <TextButton
            content="?"
            x={2.25 * B}
            y={0.25 * B}
            spreadX={0.05 * B}
            spreadY={0.05 * B}
            onClick={this.onShowHelpInfo}
          />
          <Text
            content={'\u2192'}
            fill="#E91E63"
            x={0.25 * B}
            y={0.25 * B + positionMap[itemType]}
          />

          <rect x={B} y={B} width={B} height={B} fill="black" />
          <HexBrickWall x={B} y={2.5 * B} hex={brickHex} />
          <HexSteelWall x={B} y={4 * B} hex={steelHex} />
          <River shape={0} x={B} y={5.5 * B} />
          <Snow x={B} y={7 * B} />
          <Forest x={B} y={8.5 * B} />
          <Eagle x={B} y={10 * B} broken={false} />

          {this.renderItemSwitchButtons()}
          {this.renderHexAdjustButtons()}
        </g>
      </g>
    )
  }

  renderConfigView() {
    const { enemies, name, difficulty, t } = this.state
    const totalEnemyCount = enemies.map(e => e.count).reduce(add)

    return (
      <g className="config-view">
        <Grid t={t} />
        <Text content="name:" x={3.5 * B} y={1 * B} fill="#ccc" />
        <TextInput
          x={6.5 * B}
          y={B}
          maxLength={12}
          value={name}
          onChange={name => this.setState({ name })}
        />

        <Text content="difficulty:" x={0.5 * B} y={2.5 * B} fill="#ccc" />
        <TextButton
          content="-"
          x={6.25 * B}
          y={2.5 * B}
          disabled={difficulty === 1}
          onClick={this.onDecDifficulty}
        />
        <Text content={String(difficulty)} x={7.25 * B} y={2.5 * B} fill="#ccc" />
        <TextButton
          content="+"
          x={8.25 * B}
          y={2.5 * B}
          disabled={difficulty === 4}
          onClick={this.onIncDifficulty}
        />

        <Text content="enemies:" x={2 * B} y={4 * B} fill="#ccc" />
        <g className="enemies-config" transform={`translate(${6 * B}, ${4 * B})`}>
          {enemies.map(({ tankLevel, count }, index) => (
            <g key={index} transform={`translate(0, ${1.5 * B * index})`}>
              <TextButton
                content={'\u2190'}
                x={0.25 * B}
                y={0.25 * B}
                disabled={tankLevel === 'basic'}
                onClick={() => this.onDecEnemyLevel(index)}
              />
              <Tank tank={new TankRecord({ side: 'ai', level: tankLevel, x: B, y: 0 })} />
              <TextButton
                content={'\u2192'}
                x={2.25 * B}
                y={0.25 * B}
                disabled={tankLevel === 'armor'}
                onClick={() => this.onIncEnemyLevel(index)}
              />
              <TextButton
                content="-"
                x={3.75 * B}
                y={0.25 * B}
                disabled={count === 0}
                onClick={() => this.onDecEnemyCount(index)}
              />
              <Text content={String(count).padStart(2, '0')} x={4.5 * B} y={0.25 * B} fill="#ccc" />
              <TextButton
                content="+"
                x={5.75 * B}
                y={0.25 * B}
                disabled={count === 99}
                onClick={() => this.onIncEnemyCount(index)}
              />
            </g>
          ))}
          <Text content="total:" x={0.25 * B} y={6 * B} fill="#ccc" />
          <Text
            content={String(totalEnemyCount).padStart(2, '0')}
            x={4.5 * B}
            y={6 * B}
            fill="#ccc"
          />
        </g>
      </g>
    )
  }

  renderPopup() {
    const { popup } = this.state
    if (popup == null) {
      return null
    }

    if (popup.type === 'alert') {
      return (
        <g className="popup-alert">
          <rect x={0} y={0} width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="transparent" />
          <g transform={`translate(${2.5 * B}, ${4.5 * B})`}>
            <rect x={-0.5 * B} y={-0.5 * B} width={12 * B} height={4 * B} fill="#e91e63" />
            <TextWithLineWrap x={0} y={0} fill="#333" maxLength={22} content={popup.message} />
            <TextButton
              x={9.5 * B}
              y={2.25 * B}
              textFill="#333"
              content="OK"
              onClick={this.onClickOkOfAlert}
            />
          </g>
        </g>
      )
    }

    if (popup.type === 'confirm') {
      return (
        <g className="popup-confirm">
          <rect x={0} y={0} width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="transparent" />
          <g transform={`translate(${2.5 * B}, ${4.5 * B})`}>
            <rect x={-0.5 * B} y={-0.5 * B} width={12 * B} height={4 * B} fill="#e91e63" />
            <TextWithLineWrap x={0} y={0} fill="#333" maxLength={22} content={popup.message} />
            <TextButton
              x={7.5 * B}
              y={2 * B}
              textFill="#333"
              content="no"
              onClick={this.onCancel}
            />
            <TextButton
              x={9 * B}
              y={2 * B}
              textFill="#333"
              content="yes"
              onClick={this.onConfirm}
            />
          </g>
        </g>
      )
    }
  }

  render() {
    const { match, dispatch } = this.props

    return (
      <Route
        path={`${match.url}/:view`}
        children={({ match }) => {
          // match 在这里可能为 null
          const view = match && match.params.view
          if (!['map', 'config'].includes(view)) {
            return <Redirect to="/editor/config" />
          }
          return (
            <Screen
              background="#333"
              refFn={node => (this.svg = node)}
              onMouseDown={e => this.onMouseDown(view, e)}
              onMouseUp={e => this.onMouseUp(view, e)}
              onMouseMove={e => this.onMouseMove(view, e)}
              onMouseLeave={this.onMouseLeave}
            >
              {view === 'map' ? this.renderMapView() : null}
              {view === 'config' ? this.renderConfigView() : null}
              <g className="menu" transform={`translate(0, ${13 * B})`}>
                <TextButton
                  content="config"
                  x={0.5 * B}
                  y={0.5 * B}
                  selected={view === 'config'}
                  onClick={() => dispatch(replace('/editor/config'))}
                />
                <TextButton
                  content="map"
                  x={4 * B}
                  y={0.5 * B}
                  selected={view === 'map'}
                  onClick={() => dispatch(replace('/editor/map'))}
                />
                <TextButton content="save" x={10 * B} y={0.5 * B} onClick={this.onSave} />
                <TextButton content="back" x={12.5 * B} y={0.5 * B} onClick={this.onBack} />
              </g>
              {this.renderPopup()}
            </Screen>
          )
        }}
      />
    )
  }
}

const mapStateToProps = (s: State) => ({ initialCotnent: s.editorContent, stages: s.stages })

export default connect(mapStateToProps)(Editor)