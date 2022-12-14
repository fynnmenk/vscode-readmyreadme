/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult,
	VersionedTextDocumentIdentifier
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';
import { OutlineStructureValidator } from './readmyreadme';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a the text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
// Create outlinestructure validator
let outlineStructureValidator = new OutlineStructureValidator();

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server right now doesnt supports code completion.
			completionProvider: {
				resolveProvider: false
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The settings
export interface ExampleSettings {
	maxNumberOfProblems: number;
	outlineStructure: {
		sections: Section[]
	};
}
export interface Section {
	name: string
	required: boolean
	keywords: string[]
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided
// but could happen with further clients or changes.
const defaultSettings: ExampleSettings = {
	maxNumberOfProblems: 1000,
	outlineStructure: {
		sections: [
			{
				name: "Description",
				required: true,
				keywords: [
					"Description",
					"Why?",
					"Overview",
					"Introduction",
					"Demo",
					"Example",
					"Examples",
					"About"
				]
			},
			{
				name: "Table of contents",
				required: true,
				keywords: [
					"Table of content",
					"listing",
					"tabular array",
					"agenda"
				]
			},
			{
				name: "Installation",
				required: true,
				keywords: [
					"Installation",
					"How To",
					"Quick start",
					"Getting Started",
					"Quickstart",
					"Setup",
					"Install"
				]
			},
			{
				name: "Usage",
				required: true,
				keywords: [
					"Usage",
					"Configuration",
					"Options",
					"Implementation",
					"Configure"
				]
			},
			{
				name: "Contributing",
				required: true,
				keywords: [
					"Contributing",
					"Related",
					"Involve",
					"Contribute",
					"Assistance",
					"Contact",
					"Development",
					"Contribution"
				]
			},
			{
				name: "Credits",
				required: true,
				keywords: [
					"Credits",
					"Tribute",
					"Acknowledgement",
					"Thanks",
					"Supporters",
					"Contributors",
					"Community"
				]
			},
			{
				name: "License",
				required: true,
				keywords: [
					"License",
					"Permission",
					"Consent"
				]
			},
		]
	},
};

let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.readmyreadme || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

export function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'readmyreadme'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidOpen(change => {
	validateTextDocument(change.document);
});
documents.onDidSave(change => {
	validateTextDocument(change.document);
});

// Validation of given text document
// The text document is validated for outline structure
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	const diagnostics: Diagnostic[] = [];

	//check if the document is maintainend if not show information message
	if (textDocument.version < 5) {
		connection.window.showInformationMessage("This document is not maintained. Please consider to update it.");
	}
	//validate only readme files
	if (textDocument.uri.endsWith("README.md")) {
		// validate the outline structure
		const outlineStructureDiagnostic: Diagnostic[] = await outlineStructureValidator.validateOutlineStructure(textDocument);
		diagnostics.push(...outlineStructureDiagnostic);
		// include more validation here
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();