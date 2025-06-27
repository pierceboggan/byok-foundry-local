/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode' {

	export interface LanguageModelChatInformation {
		/**
		 * Unique identifier of the language model.
		 */
		readonly id: string;

		/**
		 * Human-readable name of the language model.
		 */
		readonly name: string;

		/**
		 * Opaque family-name of the language model. Values might be `gpt-3.5-turbo`, `gpt4`, `phi2`, or `llama`
		 * but they are defined by extensions contributing languages and subject to change.
		 */
		readonly family: string;

		/**
		 * Human-readable name of the vendor of the language model (e.g. `OpenAI`, `Microsoft`, etc).
		 * This value is used for display purposes (e.g. settings UI) and must not be used to identify a vendor.
		 */
		readonly vendor: string;

		/**
		 * An optional, human-readable description of the language model.
		 */
		readonly description?: string;

		/**
		 * An optional, human-readable string representing the cost of using the language model.
		 */
		readonly cost?: string;

		/**
		 * Opaque version string of the model. This is defined by the extension contributing the language model
		 * and subject to change while the identifier is stable.
		 */
		readonly version: string;

		readonly maxInputTokens: number;

		readonly maxOutputTokens: number;
	}

	/**
	 * Represents a large language model that accepts ChatML messages and produces a streaming response
	*/
	export interface LanguageModelChatProvider {

		// TODO@API remove or keep proposed?
		onDidReceiveLanguageModelResponse2?: Event<{ readonly extensionId: string; readonly participant?: string; readonly tokenCount?: number }>;

		// TODO@API
		// have dedicated options, don't reuse the LanguageModelChatRequestOptions so that consumer and provider part of the API can develop independently
		provideLanguageModelResponse(messages: Array<LanguageModelChatMessage>, options: LanguageModelChatRequestOptions, extensionId: string, progress: Progress<ChatResponseFragment2>, token: CancellationToken): Thenable<any>;

		provideTokenCount(text: string | LanguageModelChatMessage, token: CancellationToken): Thenable<number>;
	}

	export type ChatResponseProvider = LanguageModelChatProvider;

	// TODO@API name scheme
	export interface LanguageModelChatRequestHandleOptions {
		/**
		 * The language model to use for this request.
		 */
		readonly model?: string;

		/**
		 * A human-readable message that explains why access to a language model is needed and what feature is enabled by it.
		 */
		readonly justification?: string;

		/**
		 * Do not stream the response, return it as a single result.
		 */
		readonly stream?: boolean;

		/**
		 * A set of tools that are available to the language model. The language model can choose to call these tools
		 * as part of its response. When tools are called, they result in a {@link LanguageModelToolCallPart} being added to the response.
		 *
		 * *Note* that the language model is not guaranteed to call any tools that are provided. The language model may also call
		 * tools multiple times or in a different order than they are provided.
		 *
		 * When a tool is called, the extension host will automatically call the tool's implementation and provide the result
		 * back to the language model, which can then use the result to continue its response.
		 *
		 * Then, the tool result can be provided to the LLM by creating an Assistant-type {@link LanguageModelChatMessage} with a
		 * {@link LanguageModelToolCallPart}, followed by a User-type message with a {@link LanguageModelToolResultPart}.
		 */
		tools?: LanguageModelChatTool[];

		/**
		 * 	The tool-selecting mode to use. {@link LanguageModelChatToolMode.Auto} by default.
		 */
		toolMode?: LanguageModelChatToolMode;
	}

	export interface LanguageModelChatProvider2<T extends LanguageModelChatInformation = LanguageModelChatInformation> {

		// signals a change from the provider to the editor so that prepareLanguageModelChat is called again
		onDidChange?: Event<void>;

		// NOT cacheable (between reloads)
		prepareLanguageModelChat(options: { silent: boolean }, token: CancellationToken): ProviderResult<T[]>;

		provideLanguageModelChatResponse(model: T, messages: Array<LanguageModelChatMessage>, options: LanguageModelChatRequestHandleOptions, progress: Progress<LanguageModelTextPart | LanguageModelToolCallPart>, token: CancellationToken): Thenable<any>;

		provideTokenCount(model: T, text: string | LanguageModelChatMessage, token: CancellationToken): Thenable<number>;
	}

	export interface ChatResponseFragment2 {
		index: number;
		part: LanguageModelTextPart | LanguageModelToolCallPart;
	}

	export interface ChatResponseProviderMetadata {

		readonly vendor: string;

		/**
		 * Human-readable name of the language model.
		 */
		readonly name: string;
		/**
		 * Opaque family-name of the language model. Values might be `gpt-3.5-turbo`, `gpt4`, `phi2`, or `llama`
		 * but they are defined by extensions contributing languages and subject to change.
		 */
		readonly family: string;

		/**
		 * An optional, human-readable description of the language model.
		 */
		readonly description?: string;

		/**
		 * An optional, human-readable string representing the cost of using the language model.
		 */
		readonly cost?: string;

		/**
		 * Opaque version string of the model. This is defined by the extension contributing the language model
		 * and subject to change while the identifier is stable.
		 */
		readonly version: string;

		readonly maxInputTokens: number;

		readonly maxOutputTokens: number;

		/**
		 * When present, this gates the use of `requestLanguageModelAccess` behind an authorization flow where
		 * the user must approve of another extension accessing the models contributed by this extension.
		 * Additionally, the extension can provide a label that will be shown in the UI.
		 */
		auth?: true | { label: string };

		// TODO@API maybe an enum, LanguageModelChatProviderPickerAvailability?
		readonly isDefault?: boolean;
		readonly isUserSelectable?: boolean;

		readonly capabilities?: {
			readonly vision?: boolean;

			// TODO@API should be `boolean | number` so extensions can express how many tools they support
			readonly toolCalling?: boolean;

			// TODO@API WHY is agentMode a capability? This seems wrong?
			readonly agentMode?: boolean;

			// TODO@API support prompt TSX style messages
			// readonly promptTsx?:boolean
		};

		/**
		 * Optional category to group models by in the model picker.
		 * The lower the order, the higher the category appears in the list.
		 * Has no effect if `isUserSelectable` is `false`.
		 * If not specified, the model will appear in the "Other Models" category.
		 */
		readonly category?: { label: string; order: number };

		// limit this provider to some extensions
		// TODO@API remove? unused?
		extensions?: string[];
	}

	export namespace lm {
		export function registerChatModelProvider(id: string, provider: LanguageModelChatProvider, metadata: ChatResponseProviderMetadata): Disposable;
	}

}