package be

import (
	"io/ioutil"
	"os"
	"testing"

	. "github.com/chai2010/assert"
)

func TestLocalFileStorage(t *testing.T) {
	_, err := NewLocalFileStorage("/bogus/mcboog")
	AssertNotNil(t, err, "Should return an error if handed a non-existing directory")

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

	exists, err := testFS.Exists("bogus-key", "")
	AssertNil(t, err)
	AssertFalse(t, exists)
	exists, err = testFS.Exists("bogus-key", "blatz")
	AssertNil(t, err)
	AssertFalse(t, exists)

	f1, err := TempFile(tempDir, 10)
	AssertNil(t, err)
	key, err := testFS.Put("foo.bin", f1)
	AssertNil(t, err)
	lf1, err := testFS.Get(key, "")
	AssertNil(t, err)
	name, err := lf1.Name()
	AssertNil(t, err)
	AssertEqual(t, name, "foo.bin")
	exists, err = lf1.Exists()
	AssertNil(t, err)
	AssertTrue(t, exists)
	size, err := lf1.Size()
	AssertNil(t, err)
	AssertEqual(t, size, int64(10*1024))
	f1.Seek(0, 0)
	lf1Reader, err := lf1.Reader()
	AssertNil(t, err)
	AssertTrue(t, CompareReaderData(f1, lf1Reader))
	f1.Seek(0, 0)
	lf1Reader, err = lf1.Reader()
	AssertNil(t, err, "Could not read a second time")
	AssertTrue(t, CompareReaderData(f1, lf1Reader), "Second comparison failed")

	// Test derivatives
	df1, err := TempFile(tempDir, 5)
	err = testFS.PutDerivative(key, "bar", df1)
	AssertNil(t, err)
	dlf1, err := testFS.Get(key, "bar")
	AssertNil(t, err)
	dName, err := dlf1.Name()
	AssertNil(t, err)
	AssertEqual(t, name, dName)
	dlf1Reader, err := dlf1.Reader()
	AssertNil(t, err, "Could not read derivative")
	df1.Seek(0, 0)
	AssertTrue(t, CompareReaderData(df1, dlf1Reader), "Comparison failed")

	f2, err := TempFile(tempDir, 5)
	AssertNil(t, err)
	key2, err := testFS.Put("foo.bin", f2)
	AssertNil(t, err)
	f2.Seek(0, 0)
	lf2, err := testFS.Get(key2, "")
	AssertNil(t, err)
	lf2Reader, err := lf2.Reader()
	AssertNil(t, err)
	AssertTrue(t, CompareReaderData(f2, lf2Reader))

	err = testFS.Delete("bogus-key-2", "")
	AssertNil(t, err, "Deleting non-existant keys should not return an error")
	err = testFS.Delete(lf1.Key(), "")
	AssertNil(t, err)
	err = testFS.Delete(lf2.Key(), "")
	AssertNil(t, err)
	lf2Reader, err = lf2.Reader()
	AssertNotNil(t, err)
	AssertNil(t, testFS.Delete(lf1.Key(), ""), "Deleting non-existant keys should not return an error")
	exists, err = testFS.Exists(lf1.Key(), "bar")
	AssertNil(t, err)
	AssertFalse(t, exists, "Derivatives should not exist after deleting the original file")
	AssertNil(t, testFS.Delete(lf2.Key(), ""), "Deleting non-existant keys should not return an error")
}
