import { CameraCapturedPicture, CameraView, useCameraPermissions } from 'expo-camera';
import Anthropic from '@anthropic-ai/sdk';
import { MessageParam as AnthropicMessage, TextBlock } from '@anthropic-ai/sdk/resources'
import { useRef, useState } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from '@expo/vector-icons/Ionicons';
import { FlatList } from 'react-native-gesture-handler';
import * as Speech from 'expo-speech';
import randomItem from 'random-item';

interface FlowImage {
  type: 'image';
  author: string;
  base64: string;
}

interface FlowText {
  type: 'text';
  author: string;
  content: string;
}

type FlowElement = FlowImage | FlowText;

function flowToAnthropic(flowElements: FlowElement[]) {
  const anthropicMessages: AnthropicMessage[] = [];
  for (let flowElement of flowElements) {
    switch (flowElement.type) {
      case 'image':
        anthropicMessages.push({
          'role': 'user',
          'content': [{
            'type': 'image',
            'source': {
              'type': 'base64',
              'media_type': 'image/jpeg',
              'data': flowElement.base64,
            }
          }]
        })
        break;
      case 'text':
        anthropicMessages.push({
          'role': 'assistant',
          'content': [{
            'type': 'text',
            'text': flowElement.content
          }]
        })
        break;
    }
  }
  // condense runs of messages with the same role
  const condensedAnthropicMessages: AnthropicMessage[] = [];
  let previousRole = null;
  for (let anthropicMessage of anthropicMessages) {
    if (anthropicMessage.role === previousRole) {
      condensedAnthropicMessages[condensedAnthropicMessages.length - 1].content.push(
        anthropicMessage.content[0]
      );
    } else {
      condensedAnthropicMessages.push(anthropicMessage);
    }
    previousRole = anthropicMessage.role;
  }
  return condensedAnthropicMessages;
}

export default function Index() {
  const [flow, setFlow] = useState([] as FlowElement[]);
  const [emResponseInProgress, setEmResponseInProgress] = useState(false);
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [voices, setVoices] = useState([] as Speech.Voice[]);
  
  if (voices.length === 0) {
    (async () => {
      setVoices(await Speech.getAvailableVoicesAsync());
    })();
  }


  if (!permission) {
    // Camera permissions are still loading.
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>Please grant permission for image input</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  if (cameraRef.current) {
    (async () => {
      // TODO: set aspect ratio to 4:3
      const pictureSizes = await cameraRef.current.getAvailablePictureSizesAsync()

    })()
  }

  async function takePicture() {
    // TODO: Capture both front and back
    if (cameraRef.current) {
      const options = { quality: 0.25, base64: true };
      const capturedPicture = await cameraRef.current.takePictureAsync(options) as CameraCapturedPicture;
      setFlow(prevFlow => [...prevFlow, {type: 'image', author: 'user', base64: capturedPicture.base64 as string}]);
    }
  }

  // TODO: Replace with seen/unseen system
  if (flow.length >= 1 && flow[flow.length - 1].author === 'user' && !emResponseInProgress) {
    console.log(flow.length)
    setEmResponseInProgress(true);
    const anthropic = new Anthropic({
      apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_KEY,
    });
    async function getResponse() {
      console.log("Sending request to Claude")
      let msg
      try {
        msg = await anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 72,
          messages: flowToAnthropic(flow),
        });
      } catch (error) {
        console.log(error);
        throw error;
      }
      setEmResponseInProgress(false);
      const textOutput = ((msg.content[0] as TextBlock).text);
      Speech.speak(textOutput, {
        voice: randomItem(voices.filter(voice => voice.language === 'en-GB')).identifier
      });
      setFlow(prevFlow => [...prevFlow, {type: 'text', 'author': 'claude', 
        'content': (msg.content[0] as TextBlock).text,
      }])
    }
    getResponse()
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={'back'}
        ref={cameraRef}
        animateShutter={true}
        autofocus='on' // untested
        flash='auto'
        >
        <View>
          {/* <FlatList
            data={flow}
            renderItem={({item}) => <MyText>item.content</MyText>}
          /> */}
        </View>
        <View style={styles.buttonContainer}>
          {/* TODO: List of messages with white*/}
          <TouchableOpacity style={styles.button} onPress={takePicture}>
            <Ionicons
              name="scan-circle-outline"
              size={88 /* e^4 * phi*/}
              color={'rgba(253, 253, 253, 0.95)'} />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 64,
  },
  button: {
    flex: 1,
    alignSelf: 'flex-end',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
});

const MyText = ({children}) =>
  <Text>
    {children}
  </Text>
