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
	}

	export interface LanguageModelChatProvider2<T extends LanguageModelChatInformation = LanguageModelChatInformation> {

		// signals a change from the provider to the editor so that prepareLanguageModelChat is called again
		onDidChange?: Event<void>;

		// NOT cacheable (between reloads)
		prepareLanguageModelChat(options: { silent: boolean }, token: CancellationToken): ProviderResult<T[]>;

		provideLanguageModelChatResponse(model: T, messages: Array<LanguageModelChatMessage>, options: LanguageModelChatRequestHandleOptions, progress: Progress<LanguageModelTextPart>, token: CancellationToken): Thenable<any>;

		provideTokenCount(model: T, text: string | LanguageModelChatMessage, token: CancellationToken): Thenable<number>;
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
			readonly toolCalling?: boolean;
			readonly agentMode?: boolean;
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
		export function registerChatModelProvider(id: string, provider: any, metadata: ChatResponseProviderMetadata): Disposable;
	}

}