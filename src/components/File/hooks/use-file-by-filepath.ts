import { useEffect, useState } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Text from "@tiptap/extension-text";
import "../tiptap.scss";

export const useFileByFilepath = () => {
  const [currentlyOpenedFilePath, setCurrentlyOpenedFilePath] = useState<
    string | null
  >(null);
  //   const [initialFileContent, setInitialFileContent] = useState<string | null>(
  //     null
  //   );
  /**
	 * with this editor, we want to take the HTML on the following scenarios:
		1. when the file path changes, causing a re-render
		2. When the component unmounts
		3. when the file is deleted
	 */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  //   const [editor, setEditor] = useState<Editor | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Document,
      Paragraph,
      Text,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    // content: fileContent, // modify this to be in HTML format

    // onUpdate: ({ editor }) => {
    //   const htmlContent = editor?.getHTML();
    //   if (htmlContent) {
    //     const markdown = turndownService.turndown(htmlContent);
    //     console.log("markdown is: ", markdown);
    //     debounce(setFileContent, 1000)(markdown);
    //   }
    // },
  });

  // read file, load content into fileContent
  const openFileByPath = async (newFilePath: string) => {
    //if the fileContent is null or if there is no file currently selected
    console.log("opening file: ");
    if (editor?.getHTML() !== null && currentlyOpenedFilePath !== null) {
      //save file content
      console.log("saving file", {
        filePath: currentlyOpenedFilePath,
        fileContent: editor?.getHTML() || "",
      });
      window.files
        .writeFile({
          filePath: currentlyOpenedFilePath,
          content: editor?.getHTML() || "",
        })
        .then(() => {
          window.files.indexFileInDatabase(currentlyOpenedFilePath);
        });
    }

    console.log("reading file: ", newFilePath);
    const content = (await window.files.readFile(newFilePath)) ?? "";
    console.log("fileContent read: ", content);

    setCurrentlyOpenedFilePath(newFilePath);
    // setInitialFileContent(content);

    //set the file content to null
    editor?.commands.setContent(content);
  };

  // delete file depending on file path returned by the listener
  useEffect(() => {
    let active = true;
    console.log("now active");
    const deleteFile = async (path: string) => {
      console.log("listener got file path: ", path);
      if (!active) return;
      console.log("listener is active");

      await window.files.deleteFile(path);

      // if it is the current file, clear the content and set filepath to null so that it won't save anything else
      if (currentlyOpenedFilePath === path) {
        editor?.commands.setContent("");
        setCurrentlyOpenedFilePath(null);
      }
    };

    window.ipcRenderer.receive("delete-file-listener", deleteFile);

    return () => {
      active = false;
      console.log("cleanup effect ran");
      window.ipcRenderer.removeListener("delete-file-listener", deleteFile);
    };
  }, [currentlyOpenedFilePath, editor]);

  // cleanup effect ran once, so there was only 1 re-render
  // but for each query to the delete file-listener, you only want to run the listener once, not multiple times.
  // the listener function is ran multiple times, mostly before the cleanup is done, so apparently there are eihther multiple listeners being added, or the event is fired multiple times
  // if multiple listeners -> each of them are given the same active variable so if it mutates, it will all
  // if the event is fired multiple times, each of the time it fires, it keeps going until the function is completed

  // after the effect is re-rendered, it listens to the function properly with active = true.

  // 1. Close window on the backend, trigger savefile
  // 2. on the FE, receives win.webContents.send("prepare-for-window-close", files);
  // 3. FE after saving, alerts backend that is ready for close
  useEffect(() => {
    const handleWindowClose = async () => {
      console.log("saving file", {
        filePath: currentlyOpenedFilePath,
        fileContent: editor?.getHTML() || "",
      });
      if (
        currentlyOpenedFilePath !== null &&
        editor &&
        editor?.getHTML() !== null
      ) {
        await window.files.writeFile({
          filePath: currentlyOpenedFilePath,
          content: editor?.getHTML() || "",
        });
        await window.files.indexFileInDatabase(currentlyOpenedFilePath);
      }
      window.electron.destroyWindow();
    };

    window.ipcRenderer.receive("prepare-for-window-close", handleWindowClose);

    return () => {
      window.ipcRenderer.removeListener(
        "prepare-for-window-close",
        handleWindowClose
      );
    };
  }, [currentlyOpenedFilePath]);

  return {
    filePath: currentlyOpenedFilePath,
    editor,
    // fileContent: initialFileContent,
    // deleteFile,
    openFileByPath,
  };
};
