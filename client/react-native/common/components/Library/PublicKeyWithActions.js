import { ScrollView, TextInput, Platform, Clipboard } from 'react-native'
import { btoa } from 'b64-lite'
import React, { PureComponent } from 'react'

import { Button, Flex, TextInputMultilineFix, Text } from './index'
import { RelayContext } from '../../relay'
import { colors } from '../../constants'
import {
  extractPublicKeyFromId,
  shareLinkOther,
  shareLinkSelf,
} from '../../helpers/contacts'
import { marginTop, padding, rounded, textTiny } from '../../styles'

const CopyKeyButton = ({ id }) => (
  <ActionButton
    icon='copy'
    onPress={() => Clipboard.setString(id)}
    label={'Copy the key'}
  />
)

const ShareKeyButton = ({ id, displayName, self }) => (
  <ActionButton
    icon='share'
    onPress={() =>
      self
        ? shareLinkSelf({ id, displayName })
        : shareLinkOther({ id, displayName })
    }
    label={'Share the key'}
  />
)

const ActionButton = props => (
  <Button
    icon={props.icon}
    background={colors.blue}
    margin
    padding
    rounded={23}
    height={24}
    medium
    middle
    center
    self='stretch'
    onPress={props.onPress}
  >
    {props.label}
  </Button>
)

const AddButton = ({ onPress }) => (
  <ActionButton icon='plus' onPress={onPress} label={'Add this key'} />
)

export default class PublicKeyWithActions extends PureComponent {
  static contextType = RelayContext

  constructor (props) {
    super(props)
    const [initialKey, initialName] = props.navigation
      ? [
        props.navigation.getParam('initialKey'),
        props.navigation.getParam('initialName'),
      ]
      : [props.initialKey, props.initialName]
    const missingInitialData = props.initialKey === undefined
    this.state = {
      err: null,
      contact: {
        id: initialKey || '',
        displayName: initialName || '',
        displayStatus: '',
        overrideDisplayName: '',
        overrideDisplayStatus: '',
      },
    }

    if (missingInitialData && props.data !== undefined) {
      try {
        this.state.contact = {
          ...props.data,
          id: extractPublicKeyFromId(props.data.id),
        }
      } catch (e) {
        console.error(e)
      }
    }
  }

  onSubmit = async () => {
    const input = {
      contact: {
        ...this.state.contact,
        id: btoa(`contact:${this.state.contact.id}`),
        displayName: this.state.contact.displayName,
      },
      introText: '',
    }
    try {
      await this.props.screenProps.context.mutations.contactRequest(input)
      this.props.navigation.goBack(null)
    } catch (err) {
      this.setState({ err })
    }
  }

  render () {
    const {
      navigation,
      shareButton,
      addButton,
      copyButton,
      readOnly,
      self,
    } = this.props
    const {
      contact: { id, displayName },
    } = this.state

    let errors = []
    try {
      errors = this.state.err.res.errors
    } catch (e) {
      // noop
    }

    return (
      <ScrollView>
        <Flex.Rows style={[padding]} align='center'>
          <TextInput
            placeholder={'Contact name (optional)'}
            onChangeText={displayName =>
              this.setState({ contact: { ...this.state.contact, displayName } })
            }
            value={displayName}
            style={[
              {
                backgroundColor: colors.grey7,
                color: colors.black,
                textAlign: 'left',
                width: 330,
                flex: 0,
                ...(Platform.OS === 'web' ? { outline: 'none' } : {}),
              },
              padding,
              rounded,
            ]}
          />
          <TextInputMultilineFix
            style={[
              {
                width: 330,
                height: 165,
                backgroundColor: colors.grey7,
                color: colors.black,
                flexWrap: 'wrap',
                fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
              },
              textTiny,
              padding,
              marginTop,
              rounded,
            ]}
            multiline
            placeholder='Type or copy/paste a berty user public key here'
            value={id}
            onChangeText={id =>
              this.setState({ contact: { ...this.state.contact, id } })
            }
            editable={!readOnly}
            selectTextOnFocus
          />

          {shareButton ? (
            <ShareKeyButton id={id} displayName={displayName} self={self} />
          ) : null}
          {copyButton ? <CopyKeyButton id={id} /> : null}
          {addButton ? (
            <AddButton
              id={id}
              displayName={displayName}
              navigation={navigation}
              onPress={this.onSubmit}
            />
          ) : null}
          {errors.map((err, i) => <Text multiline key={i}>{err.message}</Text>)}
        </Flex.Rows>
      </ScrollView>
    )
  }
}
