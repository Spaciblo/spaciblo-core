package be

import (
	"io/ioutil"
	"os"
	"testing"

	. "github.com/chai2010/assert"
)

func TestImageManipulation(t *testing.T) {
	// Directory for the LocalFileStorage
	fsDir, err := ioutil.TempDir(os.TempDir(), "be-test-fs")
	AssertNil(t, err, "Could not create fsDir: "+fsDir)
	defer func() {
		err = os.RemoveAll(fsDir)
		AssertNil(t, err, "Could not clean up fsDir: "+fsDir)
	}()

	// Directory for temporary source files
	tempDir, err := ioutil.TempDir(os.TempDir(), "be-temp")
	AssertNil(t, err, "Could not create tempDir: "+tempDir)
	defer func() {
		err = os.RemoveAll(tempDir)
		AssertNil(t, err, "Could not clean up tempDir: "+tempDir)
	}()

	testFS, err := NewLocalFileStorage(fsDir)
	AssertNil(t, err)

	image1, err := TempImage(tempDir, 500, 700)
	AssertNil(t, err)
	key1, err := testFS.Put("image.jpg", image1)
	AssertNil(t, err)
	fitImage1, err := FitCrop(200, 100, key1, testFS)
	AssertNil(t, err)
	reader1, err := fitImage1.Reader()
	AssertNil(t, err)
	fitImage2, err := FitCrop(200, 100, key1, testFS)
	AssertNil(t, err)
	reader2, err := fitImage2.Reader()
	AssertNil(t, err)
	Assert(t, CompareReaderData(reader1, reader2))
}
